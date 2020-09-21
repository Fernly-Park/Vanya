/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import * as TaskService from '../task/taskService';
import * as ExecutionService from '@App/components/execution/executionService';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import { Task, TaskInput, TaskOutput } from '../task/task.interfaces';
import { PassState, StateMachineStateValue, StateType, WaitState } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { applyPath, applyParameters, applyResultPath } from './path';
import { addStateEnteredEvent, addStateExistedEvent, addExecutionFailedEvent, addExecutionSucceededEvent } from './event';
import { JSONPath } from 'jsonpath-plus';
import { InvalidPathError } from '@App/errors/customErrors';
import validator from 'validator';
import * as Redis from '@App/modules/database/redis';
import { sleep } from '@Tests/testHelper';
import config from '@App/config';

type TimerInfo = Task & WaitState & {previousEventId: number}
let interpretor = true;
export const startInterpretor = async (): Promise<void> => {
    interpretor = true;

    // eslint-disable-next-line no-constant-condition
    void startTimerPoll().then()
    while(interpretor) {
        const task = await TaskService.getGeneralTaskBlocking();
        if (task) {
            void processTask(task).then();
        }
    }    
};

const startTimerPoll = async () => {
    while(interpretor === true) {
        const now = new Date();
        const timers = await TaskService.getAndDeleteDelayedTasks(now);
        if(timers && timers.length > 0) {
            for(const timer of timers) {
                const output = applyPath(timer.input, timer.OutputPath);
                await endTaskExecution({...timer, output, nextStateName: timer.Next, stateType: timer.Type});
            }
        } else {
            await sleep(config.timerPollIntervalMs);
        }
    }
}

export const processNextTask = async (): Promise<void> => {
    const task = await TaskService.getGeneralTaskBlocking();
    await processTask(task);
}

const processTask = async (task: Task): Promise<void> => {
    let result: TaskInput;
    let next: string;
    const state = await StateMachineService.retrieveStateFromStateMachine(task);
    await ExecutionService.updateContextObjectState({executionArn: task.executionArn, enteredState: {
        EnteredTime: new Date().toISOString(),
        Name: task.stateName,
    }});
    let effectiveOutput: TaskOutput;
    
    const stateEnteredEventId = await addStateEnteredEvent(task, state.Type);
    try {
        
        const effectiveInput = await filterInput(task, state);
        switch (state.Type) {
            case StateType.Pass: 
                result = processPassTask(state as PassState, effectiveInput);
                next = (state as PassState).Next
                break;
            case StateType.Wait:
                return await processWaitTask(task, state as WaitState, effectiveInput, stateEnteredEventId); 
            default: 
                throw new Error();
        }
        effectiveOutput = filterOutput(effectiveInput, result, state);
    } catch (err) {
        console.log(err)
        await addExecutionFailedEvent(task)
        return await ExecutionService.endExecution({executionArn: task.executionArn, status: ExecutionStatus.failed})
    }
    
    await endTaskExecution({...task, previousEventId: stateEnteredEventId, output: effectiveOutput, nextStateName: next, stateType: state.Type});
};

const endTaskExecution = async (req: {executionArn: string, stateMachineArn: string, stateType: StateType
    stateName: string, previousEventId: number, output: TaskOutput, nextStateName?: string}): Promise<void> => {
    const stateExitedEventId = await addStateExistedEvent(req);
    if (req.nextStateName) {
        await TaskService.addTask({executionArn: req.executionArn, stateName: req.nextStateName, input: req.output, stateMachineArn: req.stateMachineArn, previousEventId: stateExitedEventId})
    } else {
        await addExecutionSucceededEvent({result: req.output, previousEventId: stateExitedEventId, executionArn: req.executionArn})
        await ExecutionService.endExecution({executionArn: req.executionArn, output: req.output, status: ExecutionStatus.succeeded});
    }   
}

const filterInput = async (task: Task, state: StateMachineStateValue): Promise<TaskInput> => {
    const asPassState = state as PassState;
    let toReturn = applyPath(task.input, asPassState.InputPath);
    toReturn = await applyParameters(task.executionArn, toReturn, asPassState.Parameters)
    return toReturn;
}

const filterOutput = (input: TaskInput, output: TaskOutput, state: StateMachineStateValue) => {
    const asPassState = state as PassState;
    let toReturn = applyResultPath(input, output, asPassState.ResultPath);
    toReturn = applyPath(toReturn, asPassState.OutputPath);
    return toReturn;
};

// inputPath -> Parameter
const processPassTask = (state: PassState, effectiveInput: TaskInput): TaskOutput => {
    return state.Result ?? effectiveInput;
}

const processWaitTask = async (task: Task, state: WaitState, effectiveInput: TaskInput, previousEventId: number): Promise<void> => {
    let time = new Date();
    if (state.Seconds) {
        time.setSeconds(time.getSeconds() + state.Seconds);
    } else if (state.SecondsPath) {
        const seconds: number = JSONPath({json: effectiveInput as any, path: state.SecondsPath, wrap: false});
        if (!Number.isInteger(seconds) || seconds < 0) {
            throw new InvalidPathError(state.SecondsPath);
        }
        time.setSeconds(time.getSeconds() + seconds);
    } else if (state.Timestamp) {
        time = new Date(state.Timestamp);
    } else if (state.TimestampPath) {
        const timestamp: string = JSONPath({json: effectiveInput as any, path: state.TimestampPath, wrap: false});
        time = new Date(timestamp);
        if (!validator.isRFC3339(timestamp)) {
            throw new InvalidPathError(state.TimestampPath);
        }
    }
    const timerInfo: TimerInfo = {...task, ...state, input: effectiveInput, previousEventId};
    await TaskService.addToDelayedTask(time, timerInfo);
}

export const stopInterpreter = (): void => {
    interpretor = false;
}