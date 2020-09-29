/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import * as TaskService from '../task/taskService';
import * as ExecutionService from '@App/components/execution/executionService';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import * as TimerService from '@App/components/timer/timerService';

import { Task, StateInput, StateOutput, ActivityTask } from '../task/task.interfaces';
import { PassState, StateMachineStateValue, StateType, TaskState, WaitState } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { applyPath, applyParameters, applyResultPath } from './path';
import { addStateEnteredEvent, addStateExistedEvent, addExecutionFailedEvent, addExecutionSucceededEvent } from './historyEvent';
import { v4 as uuid } from 'uuid';
import { processPassTask } from './State/pass';
import { processWaitTask } from './State/wait';
import { processTaskState } from './State/task';
import { CustomEvents, eventEmitter } from '../events';

let interpretor = true;
export const startInterpretor = async (): Promise<void> => {
    interpretor = true;
    eventEmitter.on(CustomEvents.ActivityTaskSucceeded, WrapperProcessTaskStateDone)

    void processWaitingStateDone().then()
    void TimerService.startTimerPoll().then()
    while(interpretor) {
        const task = await TaskService.getGeneralTaskBlocking();
        if (task) {
            void processTask(task).then();
        }
    }    
};

export const stopInterpreter = (): void => {
    interpretor = false;
    TimerService.stopTimerPoll();
    eventEmitter.removeListener(CustomEvents.ActivityTaskSucceeded, WrapperProcessTaskStateDone)
}

const WrapperProcessTaskStateDone = (activityTask: ActivityTask): void => void processTaskStateDone(activityTask).then();

const processWaitingStateDone = async () => {
    while (interpretor) {
        const waitingState = await TimerService.retrieveWaitingStateDoneBlocking();
        if (waitingState) {
            try {
                const output = applyPath(waitingState.input, waitingState.OutputPath);
                await endStateExecution({...waitingState, output, nextStateName: waitingState.Next, stateType: waitingState.Type});
            } catch (err) {
                console.log(err)
                await addExecutionFailedEvent({...waitingState, description: (err as Error)?.message})
                return await ExecutionService.endExecution({executionArn: waitingState.executionArn, status: ExecutionStatus.failed})
            }
        }
    }
}

export const processTaskStateDone = async (activityTask: ActivityTask): Promise<void> => {
    // outputPath
    console.log('activity task : ', activityTask)
    try {
        const output = applyPath(activityTask.input, activityTask.OutputPath);
        await endStateExecution({...activityTask, output, nextStateName: activityTask.Next, stateType: activityTask.Type})
    } catch (err) {
        await addExecutionFailedEvent({...activityTask, description: (err as Error)?.message})
        return await ExecutionService.endExecution({executionArn: activityTask.executionArn, status: ExecutionStatus.failed})
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
    
    const stateEnteredEventId = await addStateEnteredEvent(task, state.Type);
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
                return await processWaitTask(task, state as WaitState, effectiveInput, stateEnteredEventId); 
            default: 
                throw new Error();
        }
        effectiveOutput = filterOutput(effectiveInput, result, state);
    } catch (err) {
        console.log(err)
        await addExecutionFailedEvent({...task, description: (err as Error)?.message})
        return await ExecutionService.endExecution({executionArn: task.executionArn, status: ExecutionStatus.failed})
    }
    
    await endStateExecution({...task, previousEventId: stateEnteredEventId, output: effectiveOutput, nextStateName: next, stateType: state.Type});
};

const endStateExecution = async (req: {executionArn: string, stateMachineArn: string, stateType: StateType
    stateName: string, previousEventId: number, output: StateOutput, nextStateName?: string}): Promise<void> => {
    const stateExitedEventId = await addStateExistedEvent(req);
    if (req.nextStateName) {
        await TaskService.addTask({executionArn: req.executionArn, stateName: req.nextStateName, 
            input: req.output, stateMachineArn: req.stateMachineArn, previousEventId: stateExitedEventId, previousStateName: req.stateName})
    } else {
        await addExecutionSucceededEvent({result: req.output, previousEventId: stateExitedEventId, executionArn: req.executionArn})
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

