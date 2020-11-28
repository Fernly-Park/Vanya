import { RunningParallelState } from "../../interpretor.interfaces";
import * as Redis from '@App/modules/database/redis';
import { Logger } from "@App/modules";
import { DALError } from "@App/errors/customErrors";
import config from "@App/config";


export const setParallelRunningStateInfo = async (req: {parallelStateKey: string, parallelStateInfo: RunningParallelState, executionArn: string}): Promise<void> => {
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

export const deleteRunningParallelStateInfo = async (req: {executionArn: string, parallelStateKey: string}): Promise<void> => {
    const redisKey = Redis.getParallelStateInfoKey(req.parallelStateKey);
    await Redis.delAsync(redisKey);
}

export const getRunningStateInsideParallel = async (parallelStateKey: string) => {
    const toReturn = {
        tasks: [] as string[],
        parallel: [] as string[],
        wait: [] as string[],
        map: [] as string[]
    }

    const parallelKey = Redis.getRunningStateInsideParallelKey(parallelStateKey);

    for (const key of await Redis.smembersAsync(parallelKey)) {
        if (key.startsWith(`${config.redis_prefix}:tasks`)) {
            toReturn.tasks.push(key.split(':')[3])
        } else if (key.startsWith(`${config.redis_prefix}:parallel`)) {
            toReturn.parallel.push(key.split(':')[3])
        } else if (key.startsWith(`${config.redis_prefix}:wait:`)) {
            toReturn.wait.push(key.split(':')[3])
        }
        // todo
    } 

    return toReturn;
}