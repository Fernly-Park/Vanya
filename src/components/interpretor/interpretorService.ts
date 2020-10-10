/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { RunningState, StateInput, StateOutput } from '../task/task.interfaces';
import { PassState, StateMachineStateValue, StateType, TaskState, WaitState } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { applyPath, applyPayloadTemplate, applyResultPath } from './path';
import { onStateEnteredEvent, onStateExitedEvent, onExecutionFailedEvent, onExecutionSucceededEvent, onActivitySucceededEvent, onActivityStartedEvent, onActivityFailedEvent } from './historyEvent';
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
            void processTask(task).then();
        }
    }
}

const processTask = async (task: RunningState): Promise<void> => {
    let result: StateInput;
    let next: string;
    const state = await StateMachineService.retrieveStateFromStateMachine(task);

    const taskToken = state.Type === StateType.Task ? uuid() : undefined;
    await ExecutionService.updateContextObject({executionArn: task.executionArn, enteredState: {
        EnteredTime: new Date().toISOString(),
        Name: task.stateName,
    }, taskToken, previousState: task.previousStateName});
    let effectiveOutput: StateOutput;
    await onStateEnteredEvent({executionArn: task.executionArn, stateName: task.stateName, stateType: state.Type, input: task.rawInput})

    try {
        
        const effectiveInput = await filterInput(task, state);
        switch (state.Type) {
            case StateType.Pass: 
                result = processPassTask(state as PassState, effectiveInput);
                next = (state as PassState).Next
                break;
            case StateType.Task:
                return await processTaskState(task, state as TaskState, effectiveInput, taskToken);
            case StateType.Wait:
                return await processWaitTask(task, state as WaitState, effectiveInput); 
            default: 
                throw new Error();
        }
        effectiveOutput = await filterOutput(task.rawInput, result, state, task);
    } catch (err) {
        console.log(err)
        return await endStateFailed({task, 
            cause: `An error occurred while executing the state '${task.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state
        })
    }
    
    await endStateSuccess({...task, output: effectiveOutput, nextStateName: next, stateType: state.Type});
};

export const endStateSuccess = async (req: {executionArn: string, stateMachineArn: string, stateType: StateType
    stateName: string, output: StateOutput, nextStateName?: string}): Promise<void> => {
    await onStateExitedEvent(req);
    if (req.nextStateName) {
        await TaskService.addGeneralTask({executionArn: req.executionArn, stateName: req.nextStateName, 
            rawInput: req.output, stateMachineArn: req.stateMachineArn, previousStateName: req.stateName})
    } else {
        await onExecutionSucceededEvent({result: req.output, executionArn: req.executionArn});
        await ExecutionService.endExecution({executionArn: req.executionArn, output: req.output, status: ExecutionStatus.succeeded});
    }   
}

export const endStateFailed = async (req: {task: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<void> => {
    const asTaskState = req.state as TaskState
    if (asTaskState.Catch != null) {
        for (const catcher of asTaskState.Catch) {
            if (catcher.ErrorEquals.includes(AWSConstant.error.STATE_ALL_ERROR)) {
                return await endStateSuccess({...req.task, stateType: req.state.Type, nextStateName: catcher.Next, output: {
                    Cause: req.cause ?? null,
                    Error: req.error ?? null
                }});
            }
        }
    }
    await onExecutionFailedEvent({...req.task, cause: req.cause, error: req.error});
    return await ExecutionService.endExecution({executionArn: req.task.executionArn, status: ExecutionStatus.failed})
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
    Event.on(Event.CustomEvents.ActivityTaskHeartbeatTimeout, processTaskTimeout);
    Event.on(Event.CustomEvents.TaskTimeout, processTaskTimeout);
    Event.on(Event.CustomEvents.WaitingStateDone, processWaitingStateDone);
}

const unregisterEvents = (): void => {
    Event.sendTaskFailureEvent.removeListener(processTaskFailed);
    Event.workerOutputReceivedEvent.removeListener(processTaskStateDone);
    Event.activityStartedEvent.removeListener(processActivityTaskStarted)
    Event.activityTaskHeartbeat.removeListener(processTaskHeartbeat);
    Event.removeListener(Event.CustomEvents.ActivityTaskHeartbeatTimeout, processTaskTimeout);
    Event.removeListener(Event.CustomEvents.TaskTimeout, processTaskTimeout);
    Event.removeListener(Event.CustomEvents.WaitingStateDone, processWaitingStateDone);
}