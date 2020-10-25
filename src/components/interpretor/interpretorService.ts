/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { RunningState, StateInput, StateOutput } from '../task/task.interfaces';
import { ChoiceState, FailState, ParallelState, PassState, StateMachineStateValue, StateType, TaskState, WaitState } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { applyPath, applyPayloadTemplate, applyResultPath } from './path';
import { onStateEnteredEvent, onStateExitedEvent, onExecutionFailedEvent, onExecutionSucceededEvent, onExecutionStartedEvent } from './historyEvent';
import { v4 as uuid } from 'uuid';
import { processPassTask } from './states/pass';
import { processWaitingStateDone, processWaitTask } from './states/wait';
import { processActivityTaskStarted, processTaskFailed, processTaskHeartbeat, processTaskState, processTaskStateDone, processTaskTimeout } from './states/task';
import * as Event from '../events';
import { TaskService } from '../task';
import { ExecutionService } from '../execution';
import { StateMachineService } from '../stateMachines';
import { TimerService } from '../timer';
import { AWSConstant } from '@App/utils/constants';
import { handleCatch, handleRetry } from './errorHandling';
import { Logger } from '@App/modules';
import { processChoiceState } from './states/choice';
import { handleFinishedBranche, processParallelState } from './states/parallel';
import { FatalError } from '@App/errors/customErrors';

let interpretor = true;
export const startInterpretor = (): void => {
    interpretor = true;
    registerEvents();
    void TimerService.startTimerPoll().then()
    void startInterpretorPoll().then();
};

export const stopInterpreter = (): void => {
    interpretor = false;

    TimerService.stopTimerPoll();
    unregisterEvents();
}

const startInterpretorPoll = async (): Promise<void> => {
    while(interpretor) {
        const task = await TaskService.getGeneralTaskBlocking();
        if (task) {
            void processRunningState(task).then();
        }
    }
}

const processRunningState = async (task: RunningState): Promise<void> => {
    let rawOutput: StateInput;
    let next: string;
    const state = await StateMachineService.retrieveStateFromStateMachine(task);
    Logger.logDebug(`processing state '${task.stateName}' from '${task.executionArn}' of type '${state.Type}'`);

    const taskToken = state.Type === StateType.Task ? uuid() : undefined;
    await ExecutionService.updateContextObject({executionArn: task.executionArn, enteredState: {
        EnteredTime: new Date().toISOString(),
        Name: task.stateName,
    }, taskToken, previousState: task.previousStateName});

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
                return await processTaskState({task, state: state as TaskState, token: taskToken});
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
        await endStateSuccess({...task, output: effectiveOutput, nextStateName: next, state});
    } catch (err) {
        Logger.logError(err ?? '');
        return await endStateFailed({task, 
            cause: `An error occurred while executing the state '${task.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state
        })  
    }
    
};

export const endStateSuccess = async (req: RunningState & {nextStateName: string, output: StateOutput, state: StateMachineStateValue}): Promise<void> => {
    Logger.logDebug(`State '${req.stateName}' of '${req.executionArn}' finished successfully. stringified effective output : '${JSON.stringify(req.output)}'`)
    req.previousEventId = await onStateExitedEvent({...req, stateType: req.state.Type});
    if (req.nextStateName) {
        await TaskService.addGeneralTask({executionArn: req.executionArn, stateName: req.nextStateName, 
            rawInput: req.output, stateMachineArn: req.stateMachineArn, previousStateName: req.stateName, previousEventId: req.previousEventId,
            parallelInfo: req.parallelInfo})
    } else {
        if (req.parallelInfo) {
            return handleFinishedBranche({output: req.output, brancheIndex: req.parallelInfo.currentBranche, parallelStateKey: req.parallelInfo.parentKey})
        }
        await onExecutionSucceededEvent({result: req.output, executionArn: req.executionArn, previousEventId: req.previousEventId});
        await ExecutionService.endExecution({executionArn: req.executionArn, output: req.output, status: ExecutionStatus.succeeded});
    }   
}

export const endStateFailed = async (req: {task: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<void> => {
    Logger.logDebug(`State from '${req.task.stateName}' from '${req.task.executionArn}' failed, handling error`)
    let wasTheErrorHandled = await handleRetry(req);
    if (!wasTheErrorHandled) {
        wasTheErrorHandled = await handleCatch(req)
    }

    if (!wasTheErrorHandled) {
        Logger.logDebug(`State from '${req.task.stateName}' from '${req.task.executionArn}', causing execution to fail`)
        await onExecutionFailedEvent({...req.task, cause: req.cause, error: req.error});
        return await ExecutionService.endExecution({executionArn: req.task.executionArn, status: ExecutionStatus.failed})
    }
}

export const filterInput = async (task: RunningState, state: StateMachineStateValue): Promise<StateInput> => {
    const asPassState = state as PassState;
    let toReturn = applyPath(task.rawInput, asPassState.InputPath);
    const contextObject = await ExecutionService.retrieveExecutionContextObject(task);
    toReturn = await applyPayloadTemplate(contextObject, toReturn, asPassState.Parameters)
    return toReturn;
}

export const filterOutput = async (rawInput: StateInput, output: StateOutput, state: StateMachineStateValue, task: RunningState): Promise<StateOutput> => {
    const asTaskState = state as TaskState;
    const contextObject = await ExecutionService.retrieveExecutionContextObject(task);
    let toReturn = applyPayloadTemplate(contextObject, output, asTaskState.ResultSelector)
    toReturn = applyResultPath(rawInput, toReturn, asTaskState.ResultPath);
    toReturn = applyPath(toReturn, asTaskState.OutputPath);
    return toReturn;
};

const registerEvents = (): void => {
    Event.sendTaskFailureEvent.on(processTaskFailed);
    Event.workerOutputReceivedEvent.on(processTaskStateDone);
    Event.activityStartedEvent.on(processActivityTaskStarted)
    Event.activityTaskHeartbeat.on(processTaskHeartbeat);
    Event.executionStartedEvent.on(onExecutionStartedEvent);
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
    Event.removeListener(Event.CustomEvents.ActivityTaskRetry, processTaskState)
    Event.removeListener(Event.CustomEvents.ActivityTaskHeartbeatTimeout, processTaskTimeout);
    Event.removeListener(Event.CustomEvents.TaskTimeout, processTaskTimeout);
    Event.removeListener(Event.CustomEvents.WaitingStateDone, processWaitingStateDone);
}