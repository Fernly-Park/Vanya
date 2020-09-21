/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import * as ExecutionService from '@App/components/execution/executionService';
import {  TaskInput, TaskOutput } from '../task/task.interfaces';
import { InvalidPathError, InvalidParameterError } from '@App/errors/customErrors';
import { ContextObject, ExecutionInput } from '../execution/execution.interfaces';
import { addProps } from '@App/utils/objectUtils';
import { JSONPath } from 'jsonpath-plus';

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

export const applyParameters = async (executionArn: string, input: TaskInput, parameters: Record<string, unknown>): Promise<TaskInput> => {
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