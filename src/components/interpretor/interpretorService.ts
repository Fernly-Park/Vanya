/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import * as TaskService from '../task/taskService';
import * as ExecutionService from '@App/components/execution/executionService';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import { Task, TaskInput, TaskOutput } from '../task/task.interfaces';
import { PassState } from '@App/components/stateMachines/stateMachine.interfaces';
import { JSONPath } from 'jsonpath-plus';
import { InvalidPathError, InvalidParameterError } from '@App/errors/customErrors';
import { ExecutionStatus, ContextObject, ExecutionInput } from '../execution/execution.interfaces';
import { addProps } from '@App/utils/objectUtils';
import { AWSConstant } from '@App/utils/constants';

let interpretor = true;
export const startInterpretor = async (): Promise<void> => {
    // eslint-disable-next-line no-constant-condition
    
    interpretor = true;
    while(interpretor) {
        const task = await TaskService.getGeneralTask();
        if (task) {
            void processTask(task).then();
        }
    }    
};

export const processNextTask = async (): Promise<void> => {
    const task = await TaskService.getGeneralTask();
    await processTask(task);
}

const processTask = async (task: Task): Promise<void> => {
    let result: TaskInput;
    let next: string;
    let lastEventId: number;
    const state = await StateMachineService.retrieveStateFromStateMachine(task);
    await ExecutionService.updateContextObjectState({executionArn: task.executionArn, enteredState: {
        EnteredTime: new Date().toISOString(),
        Name: task.stateName,
    }});

    try {
        switch (state.Type) {
            default: 
                // eslint-disable-next-line no-case-declarations
                const processTaskResult = await processPassTask(task, state as PassState);
                result = processTaskResult.output;
                lastEventId = processTaskResult.lastEventId;
                next = (state as PassState).Next
                break;
        }
    } catch (err) {
        await ExecutionService.addEvent({executionArn: task.executionArn, event: {
            previousEventId: task.previousEventId,
            type: 'ExecutionFailed',
            executionFailedEventDetails: {
                cause: `An error occurred while executing the state '${task.stateName}'`,
                error: AWSConstant.error.STATE_RUNTIME
            }
        }});
        return await ExecutionService.endExecution({executionArn: task.executionArn, status: ExecutionStatus.failed})
    }
    
    if (next) {
        await TaskService.addTask({executionArn: task.executionArn, stateName: next, input: result, stateMachineArn: task.stateMachineArn, previousEventId: lastEventId})
    } else {
        await ExecutionService.addEvent({executionArn: task.executionArn, event: {
            previousEventId: lastEventId,
            type: 'ExecutionSucceeded',
            executionSucceededEventDetails: {
                output: JSON.stringify(result),
            }
        }});
        await ExecutionService.endExecution({executionArn: task.executionArn, output: result, status: ExecutionStatus.succeeded});
    }   
};

const addStateEnteredEvent = async (task: Task): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: task.executionArn, event: {
        previousEventId: task.previousEventId,
        type: 'PassStateEntered', 
        stateEnteredEventDetails: {
            name: task.stateName,
            input: JSON.stringify(task.input),
    }}});
}

const addStateExistedEvent = async (req: {executionArn: string, previousEventId: number, stateName: string, output: unknown}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: { previousEventId: req.previousEventId,
        type: 'PassStateExited',
        stateExitedEventDetails: {
            name: req.stateName,
            output: JSON.stringify(req.output)
        }
    }})
}
// inputPath -> Parameter
const processPassTask = async (task: Task, state: PassState): Promise<{output: TaskOutput, lastEventId: number}> => {
    const stateEnteredEventId = await addStateEnteredEvent(task);
    let input = applyPath(task.input, state.InputPath);
    input = await applyParameters(task.executionArn, input, state.Parameters)
    const rawOutput = state.Result ?? input;
    let toReturn = applyResultPath(input, rawOutput, state.ResultPath);
    toReturn = applyPath(toReturn, state.OutputPath);
    const stateExitedEventId = await addStateExistedEvent({executionArn: task.executionArn, stateName: task.stateName, 
        previousEventId: stateEnteredEventId, output: toReturn});
    return {
        output: toReturn, 
        lastEventId: stateExitedEventId
    };
}

export const applyPath = (rawInput: TaskInput | TaskOutput, path: string): TaskInput | TaskOutput => {
    let toReturn: ExecutionInput;
    if (path === null) {
        return {};
    }
    if (path && path != '$') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toReturn = JSONPath({json: rawInput as any, path: path, wrap: false});
        if (!toReturn) {
            throw new InvalidPathError(path);
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

export const applyResultPath = (input: TaskInput, output: TaskOutput, resultPath: string): TaskOutput => {
    if (resultPath === null) {
        return input;
    }
    if (resultPath && resultPath != '$') {
        const resultPathWithoutPrefix = resultPath.substr(2, resultPath.length);
        return addProps(input as Record<string, unknown>, resultPathWithoutPrefix, output)
    }
    return output;
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