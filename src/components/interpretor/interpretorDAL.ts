/* eslint-disable no-fallthrough */
import { RunningState } from "./interpretor.interfaces";
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";
import * as RedisKey from '@App/modules/database/redisKeys'
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
    const key = RedisKey.executionStatusKey.get(executionArn);
    return await Redis.getAsync(key) as ExecutionStatus;
}

export const deleteRunningStateInfo = async (executionArn: string): Promise<void> => {
    const key = RedisKey.currentlyRunningStateKey.get(executionArn);
    const keysToDelete = await Redis.smembersAsync(key);
    await deleteKeys(keysToDelete);
    await Redis.delAsync(key);
}


export const saveStateInfo = async (state: RunningState): Promise<void> => {
    const key = getRedisKeyOfState(state.token, state.stateType);
    await Redis.jsonsetAsync(key, '.', JSON.stringify(state));
    await addToCurrentlyRunningState(state);
 }
  
 export const deleteStateInfo = async (state: RunningState, expireIn?: number): Promise<void> => {
    const key = getRedisKeyOfState(state.token, state.stateType);
    if (expireIn == null) {
        await Redis.delAsync(key);
    } else {
        await Redis.expireAsync(key, expireIn);
    }
    await removeFromCurrentlyRunningState(state);
 }
  
 export const getStateInfo = async (token: string, stateType: StateType): Promise<RunningState> => {
    const key = getRedisKeyOfState(token, stateType);
    const toReturn = await Redis.jsongetAsync(key);
    return toReturn ? JSON.parse(toReturn) as RunningState : null;
 }

 
const deleteKeys = async (keys: string[]): Promise<void> => {

    for (const keyToDelete of keys) {
        if (RedisKey.runningTaskStateKey.match(keyToDelete)) {
            await Redis.expireAsync(keyToDelete, config.taskTokenTimeoutSeconds);
        } else if (RedisKey.parallelStateInfoKey.match(keyToDelete)) {
            const token = RedisKey.parallelStateInfoKey.extractToken(keyToDelete);
            const keysToDelete = await Redis.smembersAsync(RedisKey.runningStateInsideParallelKey.get(token));
            await deleteKeys(keysToDelete);
            await Redis.delAsync(RedisKey.runningStateInsideParallelKey.get(token));
            await Redis.delAsync(keyToDelete);
        } else {
            await Redis.delAsync(keyToDelete);
        }
    }
}

const addToCurrentlyRunningState = async (state: RunningState): Promise<void> => {
    const key = state.parallelInfo != null 
        ? RedisKey.runningStateInsideParallelKey.get(state.parallelInfo.parentKey)
        : RedisKey.currentlyRunningStateKey.get(state.executionArn)

    await Redis.saddAsync(key, getRedisKeyOfState(state.token, state.stateType));
}

const getRedisKeyOfState = (token: string, stateType: StateType): string => {
    switch (stateType) {
        case StateType.Task: 
            return RedisKey.runningTaskStateKey.get(token);
        case StateType.Parallel:
            return RedisKey.parallelStateInfoKey.get(token)
        case StateType.Wait:
            return RedisKey.waitStateKey.get(token);
        case StateType.Map:
            // todo
        default:
            throw new Error(`'${stateType}' type cannot be added in running state (from '${token}')`)
    }
}

const removeFromCurrentlyRunningState = async (state: RunningState): Promise<void> => {
    const key = state.parallelInfo != null 
        ? RedisKey.runningStateInsideParallelKey.get(state.parallelInfo.parentKey)
        : RedisKey.currentlyRunningStateKey.get(state.executionArn)

    await Redis.sremAsync(key, getRedisKeyOfState(state.token, state.stateType));
}

export const getCurrentlyRunningState = async (executionArn: string): Promise<{taskTokens: string[], parallelTokens: string[]}>  => {
    const key = RedisKey.currentlyRunningStateKey.get(executionArn);
    return await getKeys(await Redis.smembersAsync(key))
}


export const getKeys = async (keys: string[]): Promise<{taskTokens: string[], parallelTokens: string[], waitTokens: string[]}> => {
    const toReturn = {
        taskTokens: [] as string[],
        parallelTokens: [] as string[],
        waitTokens: [] as string[]
    };

    for (const keyToDelete of keys) {
        if (RedisKey.runningTaskStateKey.match(keyToDelete)) {
            const token = RedisKey.runningTaskStateKey.extractToken(keyToDelete)
            toReturn.taskTokens.push(token); 

        } else if (RedisKey.parallelStateInfoKey.match(keyToDelete)) {
            const token = RedisKey.parallelStateInfoKey.extractToken(keyToDelete);
            toReturn.parallelTokens.push(token);

            const keysToDelete = await Redis.smembersAsync(RedisKey.runningStateInsideParallelKey.get(token));
            const toMerge = await getKeys(keysToDelete);
            toReturn.taskTokens = toReturn.taskTokens.concat(toMerge.taskTokens)
            toReturn.parallelTokens = toReturn.parallelTokens.concat(toMerge.parallelTokens)

        } else if (RedisKey.waitStateKey.match(keyToDelete)){
            const token = RedisKey.waitStateKey.extractToken(keyToDelete);
            toReturn.waitTokens.push(token)
        }
    }

    return toReturn;
}
