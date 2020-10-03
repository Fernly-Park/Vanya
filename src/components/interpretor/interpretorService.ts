/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { Task, StateInput, StateOutput } from '../task/task.interfaces';
import { PassState, StateMachineStateValue, StateType, TaskState, WaitState } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { applyPath, applyParameters, applyResultPath } from './path';
import { onStateEnteredEvent, onStateExitedEvent, onExecutionFailedEvent, onExecutionSucceededEvent, onActivitySucceededEvent, onActivityScheduledEvent, onActivityStartedEvent } from './historyEvent';
import { v4 as uuid } from 'uuid';
import { processPassTask } from './states/pass';
import { processWaitingStateDone, processWaitTask } from './states/wait';
import { processTaskState, processTaskStateDone } from './states/task';
import * as Event from '../events';
import { TaskService } from '../task';
import { ExecutionService } from '../execution';
import { StateMachineService } from '../stateMachines';
import { TimerService } from '../timer';

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

const processTask = async (task: Task): Promise<void> => {
    let result: StateInput;
    let next: string;
    const state = await StateMachineService.retrieveStateFromStateMachine(task);

    const taskToken = state.Type === StateType.Task ? uuid() : undefined;
    await ExecutionService.updateContextObject({executionArn: task.executionArn, enteredState: {
        EnteredTime: new Date().toISOString(),
        Name: task.stateName,
    }, taskToken, previousState: task.previousStateName});
    let effectiveOutput: StateOutput;
    await Event.stateEnteredEvent.emit({executionArn: task.executionArn, stateName: task.stateName, stateType: state.Type, input: task.input})

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
        effectiveOutput = filterOutput(effectiveInput, result, state);
    } catch (err) {
        console.log(err)
        await Event.executionFailedEvent.emit({...task, description: (err as Error)?.message})
        return await ExecutionService.endExecution({executionArn: task.executionArn, status: ExecutionStatus.failed})
    }
    
    await endStateExecution({...task, output: effectiveOutput, nextStateName: next, stateType: state.Type});
};

export const endStateExecution = async (req: {executionArn: string, stateMachineArn: string, stateType: StateType
    stateName: string, output: StateOutput, nextStateName?: string}): Promise<void> => {
    await Event.stateExitedEvent.emit(req);
    if (req.nextStateName) {
        await TaskService.addTask({executionArn: req.executionArn, stateName: req.nextStateName, 
            input: req.output, stateMachineArn: req.stateMachineArn, previousStateName: req.stateName})
    } else {
        await Event.executionSucceededEvent.emit({result: req.output, executionArn: req.executionArn})
        await ExecutionService.endExecution({executionArn: req.executionArn, output: req.output, status: ExecutionStatus.succeeded});
    }   
}

const filterInput = async (task: Task, state: StateMachineStateValue): Promise<StateInput> => {
    const asPassState = state as PassState;
    let toReturn = applyPath(task.input, asPassState.InputPath);
    const contextObject = await ExecutionService.retrieveExecutionContextObject(task);
    toReturn = await applyParameters(contextObject, toReturn, asPassState.Parameters)
    return toReturn;
}

const filterOutput = (input: StateInput, output: StateOutput, state: StateMachineStateValue) => {
    const asPassState = state as PassState;
    let toReturn = applyResultPath(input, output, asPassState.ResultPath);
    toReturn = applyPath(toReturn, asPassState.OutputPath);
    return toReturn;
};

const registerEvents = (): void => {
    Event.activityTaskSucceededEvent.on(processTaskStateDone);
    Event.stateEnteredEvent.on(onStateEnteredEvent);
    Event.stateExitedEvent.on(onStateExitedEvent);
    Event.activityScheduledEvent.on(onActivityScheduledEvent);
    Event.activityStartedEvent.on(onActivityStartedEvent);
    Event.activitySucceededEvent.on(onActivitySucceededEvent);
    Event.executionFailedEvent.on(onExecutionFailedEvent);
    Event.executionSucceededEvent.on(onExecutionSucceededEvent);
    Event.waitingStateDoneEvent.on(processWaitingStateDone);
}

const unregisterEvents = (): void => {
    Event.activityTaskSucceededEvent.removeListener(processTaskStateDone);
    Event.stateEnteredEvent.removeListener(onStateEnteredEvent);
    Event.stateExitedEvent.removeListener(onStateExitedEvent);
    Event.activityScheduledEvent.removeListener(onActivityScheduledEvent);
    Event.activityStartedEvent.removeListener(onActivityStartedEvent);
    Event.activitySucceededEvent.removeListener(onActivitySucceededEvent);
    Event.executionFailedEvent.removeListener(onExecutionFailedEvent);
    Event.executionSucceededEvent.removeListener(onExecutionSucceededEvent);
    Event.waitingStateDoneEvent.removeListener(processWaitingStateDone);
}