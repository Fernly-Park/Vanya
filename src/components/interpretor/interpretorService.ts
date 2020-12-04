/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { RunningState, StateInput, StateOutput } from './interpretor.interfaces';
import { ChoiceState, FailState, ParallelState, PassState, StateType, TaskState, WaitState } from '@App/components/stateMachines/stateMachine.interfaces';
import { onStateEnteredEvent, onExecutionStartedEvent, onExecutionAbortedEvent } from './historyEvent';
import { v4 as uuid } from 'uuid';
import { processPassTask } from './states/pass';
import { processWaitingStateDone, processWaitTask } from './states/wait/wait';
import { abortTaskState, processActivityTaskStarted, processTaskFailed, processTaskHeartbeat, processTaskState, processTaskStateDone, processTaskTimeout } from './states/task/task';
import * as Event from '../events';
import { StateMachineService } from '../stateMachines';
import { TimerService } from '../timer';
import { AWSConstant } from '@App/utils/constants';
import { Logger } from '@App/modules';
import { processChoiceState } from './states/choice';
import {  processParallelState } from './states/parallel/parallel';
import { FatalError } from '@App/errors/customErrors';
import { InterpretorDAL } from '.';
import { endStateFailed, endStateSuccess, filterInput, filterOutput, isExecutionStillRunning } from './stateProcessing';
import { StopExecutionEventInput } from '../events';
import { ContextObjectService } from '../contextObject';
export * from './activityTask';

let interpretor = false;

export const execute = async (state: RunningState): Promise<void> => {
    if (!interpretor) {
        await InterpretorDAL.pushToStateToRunQueue(state);
    } else {
        void processState(state).then();
    }
};


export const startInterpretor = (): void => {
    interpretor = true;
    registerEvents();
    void TimerService.startTimerPoll().then()
    void startInterpretorPoll().then();
};

export const startManualControlForTest = (): void => {
    interpretor = false;
    registerEvents();
    void TimerService.startTimerPoll().then()
}

export const stopInterpreter = (): void => {
    interpretor = false;

    TimerService.stopTimerPoll();
    unregisterEvents();
}

const startInterpretorPoll = async (): Promise<void> => {
    while(interpretor) {
        const task = await InterpretorDAL.retrieveNextStateToExecute();
        if (task) {
            void processState(task).then();
        }
    }
}

export const processNextState = async (): Promise<string> => {
    const stateToRun = await InterpretorDAL.retrieveNextStateToExecute();
    if (stateToRun) {
        await processState(stateToRun);
    }
    return stateToRun?.stateName;
}

const processState = async (task: RunningState): Promise<void> => {
    if (!await isExecutionStillRunning(task.executionArn)) {
        return;
    }
    let rawOutput: StateInput;
    let next: string;
    const state = await StateMachineService.retrieveStateFromStateMachine(task);
    Logger.logDebug(`processing state '${task.stateName}' from '${task.executionArn}' of type '${state.Type}'`);
    task.stateType = state.Type;

    const stateToken = isDelayedState(state.Type) ? uuid() : undefined;
    task.token = task.token ?? stateToken
    await ContextObjectService.updateContextObject({executionArn: task.executionArn, enteredState: {
        EnteredTime: new Date().toISOString(),
        Name: task.stateName,
    }, taskToken: stateToken, previousState: task.previousStateName});

    let effectiveOutput: StateOutput;
    task.previousEventId = await onStateEnteredEvent({executionArn: task.executionArn, stateName: task.stateName, 
        stateType: state.Type, input: task.rawInput, previousEventId: task.previousEventId})
    try {
        Logger.logDebug(`Input processed for state '${task.stateName}' from '${task.executionArn}'. stringified raw input : '${JSON.stringify(task.rawInput)}'`)
        switch (state.Type) {
            case StateType.Pass: 
                rawOutput = await processPassTask(state as PassState, task);
                next = (state as PassState).Next
                break;
            case StateType.Task:
                return await processTaskState({task, state: state as TaskState, token: stateToken});
            case StateType.Wait:
                return await processWaitTask(task, state as WaitState); 
            case StateType.Succeed:
                const effectiveInput = await filterInput(task, state);
                rawOutput = effectiveInput;
                break;
            case StateType.Fail:
                const failState = state as FailState
                return await endStateFailed({task, state, error: failState.Error, cause: failState.Cause})
            case StateType.Choice:
                const choiceResult = await processChoiceState({state: state as ChoiceState, task});
                rawOutput = choiceResult.effectiveInput;
                next = choiceResult.next
                break;
            case StateType.Parallel: 
                return await processParallelState({state: state as ParallelState, task});
            default:
                throw new FatalError(`State type in state '${task.stateName}' of state machine '${task.stateMachineArn}' does not have a correct Type`);
        }
        effectiveOutput = await filterOutput(task.rawInput, rawOutput, state, task);
        await endStateSuccess({stateInfo:task, output: effectiveOutput, nextStateName: next});
    } catch (err) {
        Logger.logError(err ?? '');
        return await endStateFailed({task, 
            cause: `An error occurred while executing the state '${task.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state
        })  
    }
};

export const saveStateInfo = async (state: RunningState): Promise<void> => {
    return await InterpretorDAL.saveStateInfo(state);
}

export const getStateInfo = async (token: string, stateType: StateType): Promise<RunningState> => {
    return await InterpretorDAL.getStateInfo(token, stateType);
}

export const deleteStateInfo = async (state: RunningState, expireIn?: number): Promise<void> => {
    return await InterpretorDAL.deleteStateInfo(state, expireIn);
}

export const isDelayedState = (stateType: StateType): boolean => {
    return stateType === StateType.Task || stateType === StateType.Parallel || stateType === StateType.Wait || stateType === StateType.Map
};

const onStopExecution = async (req: StopExecutionEventInput): Promise<void> => {
    await InterpretorDAL.deleteRunningStatesInfo(req.executionArn);
    const runningStates = await InterpretorDAL.getCurrentlyRunningState(req.executionArn);
    for (const taskToken of runningStates.taskTokens) {
        await abortTaskState(taskToken);
    }
    
    await onExecutionAbortedEvent(req);
}

const registerEvents = (): void => {
    Event.sendTaskFailureEvent.on(processTaskFailed);
    Event.workerOutputReceivedEvent.on(processTaskStateDone);
    Event.activityStartedEvent.on(processActivityTaskStarted)
    Event.activityTaskHeartbeat.on(processTaskHeartbeat);
    Event.executionStartedEvent.on(onExecutionStartedEvent);
    Event.stopExecutionEvent.on(onStopExecution);
    Event.on(Event.CustomEvents.ActivityTaskRetry, processTaskState);
    Event.on(Event.CustomEvents.ActivityTaskHeartbeatTimeout, processTaskTimeout);
    Event.on(Event.CustomEvents.TaskTimeout, processTaskTimeout);
    Event.on(Event.CustomEvents.WaitingStateDone, processWaitingStateDone);
}

const unregisterEvents = (): void => {
    Event.sendTaskFailureEvent.removeListener(processTaskFailed);
    Event.workerOutputReceivedEvent.removeListener(processTaskStateDone);
    Event.activityStartedEvent.removeListener(processActivityTaskStarted)
    Event.activityTaskHeartbeat.removeListener(processTaskHeartbeat);
    Event.executionStartedEvent.removeListener(onExecutionStartedEvent);
    Event.stopExecutionEvent.removeListener(onStopExecution);
    Event.removeListener(Event.CustomEvents.ActivityTaskRetry, processTaskState)
    Event.removeListener(Event.CustomEvents.ActivityTaskHeartbeatTimeout, processTaskTimeout);
    Event.removeListener(Event.CustomEvents.TaskTimeout, processTaskTimeout);
    Event.removeListener(Event.CustomEvents.WaitingStateDone, processWaitingStateDone);
}