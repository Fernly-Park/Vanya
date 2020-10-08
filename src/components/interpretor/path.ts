/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import {  StateInput, StateOutput } from '../task/task.interfaces';
import { InvalidPathError, InvalidParameterError } from '@App/errors/customErrors';
import { ContextObject, ExecutionInput } from '../execution/execution.interfaces';
import { addProps } from '@App/utils/objectUtils';
import { JSONPath } from 'jsonpath-plus';


export const retrieveField = <T>(input: StateInput, path: string): T => {
    return JSONPath({json: input as any, path, wrap: false}) as T;
}

export const applyPath = (rawInput: StateInput | StateOutput, path: string): StateInput | StateOutput => {
    let toReturn: ExecutionInput;
    if (path === null) {
        return {};
    }
    if (path && path != '$') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toReturn = JSONPath({json: rawInput as any, path: path, wrap: false});
        if (toReturn === undefined) {
            throw new InvalidPathError(`Invalid path '${path}' : No valid results for path: '${path}'`);
        }
    }
    return toReturn === undefined ? rawInput : toReturn;
}

export const applyPayloadTemplate = (contextObject: ContextObject, input: StateInput, parameters: Record<string, unknown>): StateInput => {
    if(!parameters) {
        return input;
    }
    const toReturn: Record<string, unknown> = {};
    for(const [key, val] of Object.entries(parameters)) {
        if(typeof val === 'object') {
            toReturn[key] = applyPayloadTemplate(contextObject, input, val as Record<string, unknown>)
        } else if (key.endsWith('.$')) {
            const value = val as string;
            const result = calculateParameterValue(input, value, contextObject);
            toReturn[key.substring(0, key.length - 2)] = result;
        } else {
            toReturn[key] = val;
        }
    }
    console.log('toReturn: ', toReturn)
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

    if (toReturn === undefined) {
        throw new InvalidParameterError(`The JSONPath '${path ?? ''}' could not be found in the input`); // TODO
    }
    return toReturn;
}