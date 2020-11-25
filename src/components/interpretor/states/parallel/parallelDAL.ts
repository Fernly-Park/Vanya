import { RunningParallelState } from "../../interpretor.interfaces";
import * as Redis from '@App/modules/database/redis';
import { Logger } from "@App/modules";
import { DALError } from "@App/errors/customErrors";


export const setParallelRunningStateInfo = async (req: {parallelStateKey: string, parallelStateInfo: RunningParallelState, executionArn: string}): Promise<void> => {
    const redisKey = Redis.getParallelStateInfoKey(req.parallelStateKey);
    await Redis.jsonsetAsync(redisKey, '.', JSON.stringify(req.parallelStateInfo))
    await addToCurrentlyRunningState({executionArn: req.executionArn, redisKeyToAdd:redisKey})
}

const addToCurrentlyRunningState = async (req: {executionArn: string, redisKeyToAdd: string}): Promise<void> => {
    const key = Redis.getCurrentlyRunningStateKey(req.executionArn);
    await Redis.saddAsync(key, req.redisKeyToAdd);
}

export const updateRunningParallelStateInfo = async (req: {parallelStateKey: string, output: string, brancheNumber: number}): Promise<number> => {
    try {
        const redisKey = Redis.getParallelStateInfoKey(req.parallelStateKey);
        await Redis.jsonsetAsync(redisKey, `.output[${req.brancheNumber}]`, req.output);
        return +(await Redis.jsonNumIncrByAsync(redisKey, '.numberOfBranchesLeft', -1));
    } catch (err){
        Logger.logError(err);
        throw new DALError(`An error occured when updating the running parallel state '${req.parallelStateKey ?? ''}'`)
    }
}

export const getRunningParallelStateInfo = async (parallelStateKey: string): Promise<RunningParallelState> => {
    const redisKey = Redis.getParallelStateInfoKey(parallelStateKey);
    return JSON.parse(await Redis.jsongetAsync(redisKey)) as RunningParallelState;
}

export const deleteRunningParallelStateInfo = async (req: {executionArn: string, parallelStateKey: string}): Promise<void> => {
    const redisKey = Redis.getParallelStateInfoKey(req.parallelStateKey);
    await Redis.delAsync(redisKey);
    await removeFromCurrentlyRunningState({executionArn: '', redisKeyToRemove: redisKey});
}

const removeFromCurrentlyRunningState = async (req: {executionArn: string, redisKeyToRemove: string}): Promise<void> => {
    const key = Redis.getCurrentlyRunningStateKey(req.executionArn);
    await Redis.sremAsync(key, req.redisKeyToRemove);
}