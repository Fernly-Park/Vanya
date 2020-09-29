/* eslint-disable @typescript-eslint/unbound-method */

import redis from 'redis';
import { promisify } from 'util';
import config from '@App/config';
import genericPool from 'generic-pool';

export let client: redis.RedisClient;
let connectionPool: genericPool.Pool<redis.RedisClient>;
// eslint-disable-next-line @typescript-eslint/ban-types
const pooledFunctionFactory = (func: Function) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (...args :any) => {
        const connection = await connectionPool.acquire();
        // eslint-disable-next-line @typescript-eslint/ban-types
        const funcAsync: Function = promisify(func).bind(connection);

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await funcAsync(...args);
        } finally {
            await connectionPool.release(connection);
        }
    }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const customPooledFunctionFactory = (commandName: string) => {
    const cmd = pooledFunctionFactory(client.send_command)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (...args: any) => {
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return await cmd(commandName, args);
    }
}

export let getAsync: (arg1: string) => Promise<string>;
export let setAsync: (key: string, value: string) => Promise<boolean>;
export let delAsync: (key: string) => Promise<void>;
export let rpushAsync: (key: string, ...args: string[]) => Promise<number>;
export let flushallAsync: () => Promise<unknown>;
export let llenAsync: (key: string) => Promise<number>;
export let lpopAsync: (key: string) => Promise<string>;
export let blpopAsync: (key: string, timeout: number) => Promise<[string, string]>;
export let hsetAsync: (key: string, field: string, value: string) => Promise<void>
export let hgetAsync: (key: string, field: string) => Promise<string>
export let hdelAsync: (key: string, field: string) => Promise<void>
export let incrAsync: (key: string) => Promise<number>;
export let lrangeAsync: (key: string, from: number, toIncluded: number) => Promise<string[]>
export let zaddAsync: (key: string, score: number, member: string) => Promise<void>
export let zrangebyscoreAsync: (key: string, min: number|string, max: number|string) => Promise<string[]>
export let zremrangebyscoreAsync: (key: string, min: number|string, max: number|string) => Promise<void>
export let zcountAsync: (key: string, min: number|string, max: number|string) => Promise<number>
export let multiAsync: (callback: (multi: redis.Multi) => Promise<string[]>) => Promise<string[]>
export let watchAsync: (key: string, callback: (watcher: redis.RedisClient) => Promise<string[]>) => Promise<string[]>
export let jsonsetAsync: (key: string, path: string, json: string) => Promise<boolean>;
export let jsongetAsync: (key: string, path?: string) => Promise<string>;
export let jsondelAsync: (key: string, path?: string) => Promise<void>;

export const quitAsync = async (): Promise<void> => {
    if (connectionPool) {
        await connectionPool.drain();
        await connectionPool.clear();
    }
    if (client) {
        await promisify(client.quit).bind(client)();
    }
}


export const startRedis = () => {
    client = redis.createClient();
    connectionPool = genericPool.createPool({
        create: () => {
            return (promisify(client.duplicate).bind(client) as () => Promise<redis.RedisClient>)();
        },
        destroy: (currentClient: redis.RedisClient) => {
            return (promisify(currentClient.quit).bind(currentClient) as unknown as () => Promise<void>)()
        }
    }, {
        min: 10,
        max: 10000
    });

    getAsync = pooledFunctionFactory(client.get)
    setAsync = pooledFunctionFactory(client.set)
    delAsync = pooledFunctionFactory(client.del)
    rpushAsync = pooledFunctionFactory(client.rpush)
    flushallAsync = pooledFunctionFactory(client.flushall)
    llenAsync = pooledFunctionFactory(client.llen)
    lpopAsync = pooledFunctionFactory(client.lpop)
    blpopAsync = pooledFunctionFactory(client.blpop)
    hsetAsync = pooledFunctionFactory(client.HSET)
    hgetAsync = pooledFunctionFactory(client.HGET)
    hdelAsync = pooledFunctionFactory(client.HDEL)
    incrAsync = pooledFunctionFactory(client.incr);
    lrangeAsync = pooledFunctionFactory(client.lrange);
    zaddAsync = pooledFunctionFactory(client.zadd);
    zrangebyscoreAsync = pooledFunctionFactory(client.zrangebyscore);
    zremrangebyscoreAsync = pooledFunctionFactory(client.zremrangebyscore);
    zcountAsync = pooledFunctionFactory(client.zcount);

    watchAsync = async (keyToWatch: string, callback: (watcher: redis.RedisClient) => Promise<string[]>) => {
        const watcher = await connectionPool.acquire();
        try {
            const watchAsync = promisify(watcher.watch).bind(watcher) as (key: string) => Promise<'OK'>;
            await watchAsync(keyToWatch);
            return await callback(watcher);
        } finally {
            await connectionPool.release(watcher);
        }

    }

    multiAsync = async (callback: (multi: redis.Multi) => Promise<string[]>) => {
        const connection = await connectionPool.acquire();
        try {
            const results = await callback(connection.multi());
            return results;
        } finally {
            await connectionPool.release(connection);
        }
    }
    jsonsetAsync = customPooledFunctionFactory("JSON.SET")
    jsongetAsync = customPooledFunctionFactory("JSON.GET")
    jsondelAsync = customPooledFunctionFactory("JSON.DEL")
}

export const onConnectionSuccess = (callback: () => void ): void => {
    client.on('connect', callback);
}

export const onConnectionError = (callback: () => void ): void => {
    client.on('error', callback);
}

export const systemTaskKey = `${config.redis_prefix}:systemTasks`;
export const timerKey = `${config.redis_prefix}:timedTasks`;
export const waitingStatesKey = `${config.redis_prefix}:finishedWaitingState`;

export const getContextObjectKey = (executionArn: string): string => {
    return `${config.redis_prefix}:${executionArn}:contextObject`
}

export const getStateMachineStatesKey = (stateMachineArn: string): string => {
    return `${config.redis_prefix}:${stateMachineArn}:states`
}

export const getExecutionEventKey = (executionArn: string): string => {
    return `${config.redis_prefix}:${executionArn}:events`
}

export const getExecutionEventCurrentIdKey = (executionArn: string): string => {
    return `${config.redis_prefix}:${executionArn}:currentEventId`;
}

export const getActivityTaskKey = (activityArn: string): string => {
    return `${config.redis_prefix}:${activityArn}:tasks`;
}

export const getActivityTaskInProgressKey = (token: string): string => {
    return `${config.redis_prefix}:tasks:${token}`;
}

export const getTaskInProgress = (taskToken: string): string => {
    return `${config.redis_prefix}:${taskToken}:tasks`;
}
