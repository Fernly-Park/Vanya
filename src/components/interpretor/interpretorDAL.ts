/* eslint-disable no-fallthrough */
import { RunningState } from "./interpretor.interfaces";
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";

import { ExecutionStatus } from "../execution/execution.interfaces";
import { StateType } from "../stateMachines/stateMachine.interfaces";

export const pushToStateToRunQueue = async (task: RunningState): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}

export const retrieveNextStateToExecute = async (): Promise<RunningState> => {
    const result = await Redis.blpopAsync(Redis.systemTaskKey, config.redisBlockingTimeout);
    return result ? JSON.parse(result[1]) as RunningState : null;
}


export const getExecutionStatus = async (executionArn: string): Promise<ExecutionStatus> => {
    const key = Redis.getExecutionStatusKey(executionArn);
    return await Redis.getAsync(key) as ExecutionStatus;
}

export const deleteRunningStateInfo = async (executionArn: string): Promise<void> => {
    const key = Redis.getCurrentlyRunningStateKey(executionArn);
    const keysToDelete = await Redis.smembersAsync(key);
    await deleteKeys(keysToDelete);
    await Redis.delAsync(key);
}

const deleteKeys = async (keys: string[]): Promise<void> => {
    for (const keyToDelete of keys) {
        if (keyToDelete.startsWith(`${config.redis_prefix}:tasks`)) {
            await Redis.expireAsync(keyToDelete, config.taskTokenTimeoutSeconds);
        } else if (keyToDelete.startsWith(`${config.redis_prefix}:parallel`)) {
            const keysToDelete = await Redis.smembersAsync(`${keyToDelete}:currentlyRunningStates`);
            await deleteKeys(keysToDelete);
            await Redis.delAsync(`${keyToDelete}:currentlyRunningStates`);
            await Redis.delAsync(keyToDelete);
        } else {
            await Redis.delAsync(keyToDelete);
        }
    }
}

export const addToCurrentlyRunningState = async (state: RunningState, stateType: StateType): Promise<void> => {
    const key = state.parallelInfo != null 
        ? Redis.getRunningStateInsideParallelKey(state.parallelInfo.parentKey)
        : Redis.getCurrentlyRunningStateKey(state.executionArn)

    await Redis.saddAsync(key, getRedisKeyOfState(state.token, stateType));
}

const getRedisKeyOfState = (token: string, stateType: StateType): string => {
    switch (stateType) {
        case StateType.Task: 
            return Redis.getRunningTaskStateKey(token);
        case StateType.Parallel:
            return Redis.getParallelStateInfoKey(token)
        case StateType.Wait:
            // todo
        case StateType.Map:
            // todo
        default:
            throw new Error('Only task, parallel, wait and map state needs to be added to the running state')
    }
}

export const removeFromCurrentlyRunningState = async (state: RunningState, stateType: StateType): Promise<void> => {
    const key = state.parallelInfo != null 
        ? Redis.getRunningStateInsideParallelKey(state.parallelInfo.parentKey)
        : Redis.getCurrentlyRunningStateKey(state.executionArn)

    await Redis.sremAsync(key, getRedisKeyOfState(state.token, stateType));
}

export const getCurrentlyRunningState = async (executionArn: string): Promise<{taskTokens: string[], parallelTokens: string[]}>  => {
    const key = Redis.getCurrentlyRunningStateKey(executionArn);
    return await getKeys(await Redis.smembersAsync(key))
}


export const getKeys = async (keys: string[]): Promise<{taskTokens: string[], parallelTokens: string[]}> => {
    const toReturn = {
        taskTokens: [] as string[],
        parallelTokens: [] as string[]
    };

    for (const keyToDelete of keys) {
        if (keyToDelete.startsWith(`${config.redis_prefix}:tasks`)) {
            toReturn.taskTokens.push(keyToDelete.split(':')[3]); // todo incorrect
        } else if (keyToDelete.startsWith(`${config.redis_prefix}:parallel`)) {
            toReturn.parallelTokens.push(keyToDelete.split(':')[3])
            const keysToDelete = await Redis.smembersAsync(`${keyToDelete}:currentlyRunningStates`);
            const toMerge = await getKeys(keysToDelete);
            toReturn.taskTokens = toReturn.taskTokens.concat(toMerge.taskTokens)
            toReturn.parallelTokens = toReturn.parallelTokens.concat(toMerge.parallelTokens)
        } 
    }

    return toReturn;
}
