import { ContextObject } from "./contextObject.interfaces";
import * as Redis from '@App/modules/database/redis';
import * as RedisKey from '@App/modules/database/redisKeys'

export const setContextObject = async (executionArn: string, contextObject: ContextObject): Promise<void> => {
    const redisKey = RedisKey.contextObjectKey.get(executionArn);
    for(const [objectKey, val] of Object.entries(contextObject)) {
        await Redis.hsetAsync(redisKey, objectKey, JSON.stringify(val));
    }
    await Redis.hsetAsync(redisKey, 'State', JSON.stringify({}));

}
export type StoredContextObject = ContextObject & {State: Record<string, any>}
export const updateContextObject = async (req: {executionArn: string, update: Record<string, unknown>, token?: string, stateName: string}): Promise<void> => {
    const key = RedisKey.contextObjectKey.get(req.executionArn);
    await Redis.hsetAsync(key, `State:${req.stateName}`, JSON.stringify(req.update));
    if (req.token) {
        await Redis.hsetAsync(key, `State:${req.stateName}:Task`, JSON.stringify({Token: req.token}))
    }
    
} 

export const getContextObject = async (executionArn: string, stateName: string): Promise<ContextObject> => {
    const key = RedisKey.contextObjectKey.get(executionArn);
    const contextObject = await Redis.hgetAllAsync(key);
    if (!contextObject) {
        return null;
    }
    const toReturn: ContextObject = {
        Execution: JSON.parse(contextObject["Execution"] as string),
        StateMachine: JSON.parse(contextObject["StateMachine"] as string),
        State: contextObject[`State:${stateName}`] ? JSON.parse(contextObject[`State:${stateName}`] as string) : undefined,
        Task: contextObject[`State:${stateName}:Task`] ? JSON.parse(contextObject[`State:${stateName}:Task`] as string): undefined
    };

    return toReturn;
}

export const deleteContextObject = async (executionArn: string, stateName?: string): Promise<void> => {
    const key = RedisKey.contextObjectKey.get(executionArn);
    if (stateName) {
        await Redis.hdelAsync(key, `State:${stateName}`);
        await Redis.hdelAsync(key, `State:${stateName}:Task`);
    } else {
        await Redis.delAsync(key);
    }
}