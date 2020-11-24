import { RunningParallelState } from "../../interpretor.interfaces";
import * as Redis from '@App/modules/database/redis';
import { Logger } from "@App/modules";
import { DALError } from "@App/errors/customErrors";


export const setParallelRunningStateInfo = async (req: {parallelStateKey: string, parallelStateInfo: RunningParallelState}): Promise<void> => {
    const redisKey = Redis.getParallelStateInfoKey(req.parallelStateKey);
    await Redis.jsonsetAsync(redisKey, '.', JSON.stringify(req.parallelStateInfo))
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

export const deleteRunningParallelStateInfo = async (parallelStateKey: string): Promise<void> => {
    const redisKey = Redis.getParallelStateInfoKey(parallelStateKey);
    await Redis.delAsync(redisKey);
}