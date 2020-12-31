import * as Redis from '@App/modules/database/redis';
import { Logger } from "@App/modules";
import { DALError } from "@App/errors/customErrors";
import * as RedisKey from '@App/modules/database/redisKeys'
import { StateType } from '@App/components/stateMachines/stateMachine.interfaces';


export const updateRunningStateInfo = async (req: {parallelStateKey: string, output: string, brancheNumber: number, stateType: StateType}): Promise<number> => {
    try {
        const redisKey = req.stateType === StateType.Parallel ? 
             RedisKey.parallelStateInfoKey.get(req.parallelStateKey) : 
             RedisKey.mapStateKey.get(req.parallelStateKey);
        await Redis.jsonsetAsync(redisKey, `.output[${req.brancheNumber}]`, req.output);
        return +(await Redis.jsonNumIncrByAsync(redisKey, '.numberOfBranchesLeft', -1));
    } catch (err){
        Logger.logError(err);
        throw new DALError(`An error occured when updating the running parallel state '${req.parallelStateKey ?? ''}'`)
    }
}

export const getRunningStateInside = async (parallelStateToken: string) => {
    const toReturn = {
        tasks: [] as string[],
        parallel: [] as string[],
        wait: [] as string[],
        map: [] as string[]
    }

    const parallelKey = RedisKey.runningStateInsideParallelKey.get(parallelStateToken);

    for (const key of await Redis.smembersAsync(parallelKey)) {
        if (RedisKey.runningTaskStateKey.match(key)) {
            const token = RedisKey.runningTaskStateKey.extractToken(key);
            toReturn.tasks.push(token)

        } else if (RedisKey.parallelStateInfoKey.match(key)) {
            const token = RedisKey.parallelStateInfoKey.extractToken(key);
            toReturn.parallel.push(token)

        } else if (RedisKey.waitStateKey.match(key)) {
            const token = RedisKey.waitStateKey.extractToken(key);
            toReturn.wait.push(token)
        } else if (RedisKey.mapStateKey.match(key)) {
            const token = RedisKey.mapStateKey.extractToken(key);
            toReturn.map.push(token)
        }
        // todo
    } 

    return toReturn;
}