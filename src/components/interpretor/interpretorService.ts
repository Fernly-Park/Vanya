/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import * as TaskService from '../task/taskService';
import * as ExecutionService from '@App/components/execution/executionService';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import { Task, TaskInput } from '../task/task.interfaces';
import { PassState, StateMachineStateValue } from '@App/components/stateMachines/stateMachine.interfaces';
import { JSONPath } from 'jsonpath-plus';
import { InvalidInputPathError, InvalidParameterError } from '@App/errors/customErrors';
import { ExecutionStatus, ContextObject, ExecutionInput } from '../execution/execution.interfaces';
import { isAnObject } from '@App/utils/objectUtils';
import { LexRuntime } from 'aws-sdk';

let interpretor = true;
export const startInterpretor = async (): Promise<void> => {
    // eslint-disable-next-line no-constant-condition
    interpretor = true;
    while(interpretor) {
        const task = await TaskService.getGeneralTask();
        void processTask(task).then();
    }    
};

export const processNextTask = async (): Promise<void> => {
    const task = await TaskService.getGeneralTask();
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

    try {
        switch (state.Type) {
            default: 
                result = await processPassTask(task, state as PassState)
                next = (state as PassState).Next
                break;
        }
    } catch (err) {
        return await ExecutionService.endExecution({executionArn: task.executionArn, status: ExecutionStatus.failed})
    }
    
    if (next) {
        await TaskService.addTask({executionArn: task.executionArn, stateName: next, input: result, stateMachineArn: task.stateMachineArn})
    } else {
        await ExecutionService.endExecution({executionArn: task.executionArn, output: result, status: ExecutionStatus.succeeded});
    }   
};
// inputPath -> Parameter
const processPassTask = async (task: Task, state: PassState): Promise<TaskInput> => {
    let input = applyInputPath(task.input, state.InputPath);
    input = await applyParameters(task.executionArn, input, state.Parameters)
    return state.Result ?? input;
}

const applyInputPath = (rawInput: TaskInput, inputPath: string): TaskInput => {
    let toReturn: ExecutionInput;
    if (inputPath && inputPath != '$') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toReturn = JSONPath({json: rawInput as any, path: inputPath, wrap: false});
        if (!toReturn) {
            throw new InvalidInputPathError(inputPath);
        }
    }
    return toReturn ?? rawInput;
}

const applyParameters = async (executionArn: string, input: TaskInput, parameters: Record<string, unknown>): Promise<TaskInput> => {
    if(!parameters) {
        return input;
    }
    const toReturn: Record<string, unknown> = {};
    let contextObject: ContextObject;

    const retrieveContextObject = async () => {
        if (contextObject) {
            return Promise.resolve(contextObject);
        }
        return await ExecutionService.retrieveExecutionContextObject({executionArn});
    };

    for(const [key, val] of Object.entries(parameters)) {
        if (key.endsWith('.$')) {
            const value = val as string;
            const result = await calculateParameterValue(input, value, retrieveContextObject);
            toReturn[key.substring(0, key.length - 2)] = result;
        } else {
            toReturn[key] = val;
        }
    }

    return toReturn;
}

const calculateParameterValue = async (input: TaskInput, value: string, getContextObject: () => Promise<ContextObject>): Promise<Record<string, unknown>> => {
    let toReturn: Record<string, unknown>;
    if (value.startsWith('$$')) {
        toReturn = (JSONPath({json: await getContextObject(), path: value.substr(1)}) as Record<string, unknown>[])[0]
    } else if (value.startsWith('$')) {
        toReturn = (JSONPath({json: input as string, path: value}) as Record<string, unknown>[])[0]
    } 

    if (!toReturn) {
        throw new InvalidParameterError(value); // TODO
    }
    return toReturn;
}

export const stopInterpreter = (): void => {
    interpretor = false;
}