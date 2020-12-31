/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { RunningState, RunningTaskState, StateInput, StateOutput } from './interpretor.interfaces';
import { ChoiceState, FailState, ParallelState, PassState, StateMachineStateValue, StateType, TaskState, WaitState } from '@App/components/stateMachines/stateMachine.interfaces';
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
import {  handleFinishedBranche, processParallelState } from './states/parallel/parallel';
import { FatalError, TaskTimedOutError } from '@App/errors/customErrors';
import { InterpretorDAL } from '.';
import { endStateFailed, endStateSuccess, filterInput, filterOutput, isExecutionStillRunning } from './stateProcessing';
import { InterpretorEventInput, onStateRetryInput, StopExecutionEventInput } from '../events';
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
                return await processTaskState({task, state: state as TaskState});
            case StateType.Wait:
                return await processWaitTask(task, state as WaitState); 
            case StateType.Succeed:
                const effectiveInput = await filterInput(task, state);
                rawOutput = effectiveInput;
                break;
            case StateType.Fail:
                const failState = state as FailState
                return await endStateFailed({stateInfo: task, state, error: failState.Error, cause: failState.Cause})
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
        await onStateError({stateInfo: task, error: err, state});
    }
};

export const onStateError = async (input: {stateInfo: RunningState, state: StateMachineStateValue, error: Error}): Promise<void> => {
    const {stateInfo, error, state} = input;
    Logger.logError(error ?? '');
    return await endStateFailed({stateInfo, 
        cause: `An error occurred while executing the state '${stateInfo.stateName}'. ${error?.message ?? ''}`,
        error: AWSConstant.error.STATE_RUNTIME,
        state
    }) ;
}
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


const onStateRetry = async (req: onStateRetryInput): Promise<void> => {
    const {stateInfo} = req
    if (stateInfo.stateType === StateType.Task) {
        await processTaskState({task: stateInfo, state: req.state as TaskState});
    } else if (stateInfo.stateType === StateType.Parallel) {
        await processParallelState({task: stateInfo, state: req.state as ParallelState});
    }
    
};

const manageErrorInState = (func: (input: InterpretorEventInput) => Promise<void>) => {
    return async (input: InterpretorEventInput) => {
        try {
            await func(input);
        } catch (err) {
            if (err instanceof TaskTimedOutError) throw err;
            Logger.logError(err);
            const stateInfo = input.stateInfo ?? await getStateInfo(input.token, StateType.Task);
            const state = await StateMachineService.retrieveStateFromStateMachine(stateInfo);
            await onStateError({stateInfo, state, error: err});
        }
    } 
 } 

const registerEvents = (): void => {

    Event.on(Event.CustomEvents.TaskRetry, manageErrorInState(onStateRetry));
    Event.on(Event.CustomEvents.ActivityTaskHeartbeatTimeout, manageErrorInState(processTaskTimeout));
    Event.on(Event.CustomEvents.TaskTimeout, manageErrorInState(processTaskTimeout));
    Event.on(Event.CustomEvents.WaitingStateDone, manageErrorInState(processWaitingStateDone));
    Event.finishedParallelBranche.on(manageErrorInState(handleFinishedBranche));
    Event.executionStartedEvent.on(onExecutionStartedEvent);
}

export const activityTaskStarted = manageErrorInState(processActivityTaskStarted) as (input: {stateInfo: RunningTaskState, workerName?: string}) => Promise<void>;
export const manageTaskHeartbeat = manageErrorInState(processTaskHeartbeat);
export const manageTaskStateDone = manageErrorInState(processTaskStateDone) as (input: {stateInfo: RunningTaskState}) => Promise<void>;
export const manageTaskStateFailure = manageErrorInState(processTaskFailed) as (input: Event.SendTaskFailureEventInput) => Promise<void>;
export const manageStopExecution = onStopExecution;

const unregisterEvents = (): void => {
    Event.executionStartedEvent.removeAllListener();
    Event.removeListenerForEvent(Event.CustomEvents.TaskRetry)
    Event.removeListenerForEvent(Event.CustomEvents.ActivityTaskHeartbeatTimeout);
    Event.removeListenerForEvent(Event.CustomEvents.TaskTimeout);
    Event.removeListenerForEvent(Event.CustomEvents.WaitingStateDone);
}