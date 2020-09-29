/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import {  StateInput, StateOutput } from '../task/task.interfaces';
import { InvalidPathError, InvalidParameterError } from '@App/errors/customErrors';
import { ContextObject, ExecutionInput } from '../execution/execution.interfaces';
import { addProps } from '@App/utils/objectUtils';
import { JSONPath } from 'jsonpath-plus';

export const applyPath = (rawInput: StateInput | StateOutput, path: string): StateInput | StateOutput => {
    let toReturn: ExecutionInput;
    if (path === null) {
        return {};
    }
    if (path && path != '$') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toReturn = JSONPath({json: rawInput as any, path: path, wrap: false});
        if (!toReturn) {
            throw new InvalidPathError(`Invalid path '${path}' : No results for path: '${path}'`);
        }
    }
    return toReturn ?? rawInput;
}

export const applyParameters = (contextObject: ContextObject, input: StateInput, parameters: Record<string, unknown>): StateInput => {
    if(!parameters) {
        return input;
    }
    const toReturn: Record<string, unknown> = {};
    for(const [key, val] of Object.entries(parameters)) {
        if (key.endsWith('.$')) {
            const value = val as string;
            const result = calculateParameterValue(input, value, contextObject);
            toReturn[key.substring(0, key.length - 2)] = result;
        } else {
            toReturn[key] = val;
        }
    }

    return toReturn;
}

export const applyResultPath = (input: StateInput, output: StateOutput, resultPath: string): StateOutput => {
    if (resultPath === null) {
        return input;
    }
    if (resultPath && resultPath != '$') {
        const resultPathWithoutPrefix = resultPath.substr(2, resultPath.length);
        return addProps(input as Record<string, unknown>, resultPathWithoutPrefix, output)
    }
    return output;
}

const calculateParameterValue = (input: StateInput, path: string, contextObject: ContextObject): Record<string, unknown> => {
    let toReturn: Record<string, unknown>;
    if (path.startsWith('$$')) {
        toReturn = (JSONPath({json: contextObject, path: path.substr(1)}) as Record<string, unknown>[])[0]
    } else if (path.startsWith('$')) {
        toReturn = (JSONPath({json: input as string, path: path}) as Record<string, unknown>[])[0]
    } 

    if (!toReturn) {
        throw new InvalidParameterError(`The JSONPath '${path ?? ''}' could not be found in the input`); // TODO
    }
    return toReturn;
}