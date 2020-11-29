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
export let lremAsync: (key: string, count: number, element: string) => Promise<number>;
export let flushallAsync: () => Promise<unknown>;
export let llenAsync: (key: string) => Promise<number>;
export let lpopAsync: (key: string) => Promise<string>;
export let blpopAsync: (key: string, timeout: number) => Promise<[string, string]>;
export let hsetAsync: (key: string, field: string, value: string) => Promise<void>
export let hgetAsync: (key: string, field: string) => Promise<string>
export let hgetAllAsync : (key: string) => Promise<Record<string, unknown>>;
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
export let zremAsync: (key: string, member: string) => Promise<number>;
export let hmsetAsync: (key: string, arg: {[key: string]: string | number}) => Promise<void>;
export let jsonNumIncrByAsync: (key: string, path: string, number: number) => Promise<number>
export let keysAsync: (pattern: string) => Promise<string[]>
export let saddAsync: (key: string, member: string) => Promise<void>;
export let sremAsync: (key: string, member: string) => Promise<void>;
export let smembersAsync: (key: string) => Promise<string[]>;
export let expireAsync: (key: string, seconds: number) => Promise<void>;
export let ttlAsync: (key: string) => Promise<number>;

let existsAsyncWithNumber: (key: string) => Promise<number>;
export const existsAsync = async (key: string): Promise<boolean> => {
    return await existsAsyncWithNumber(key) === 1;
}

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
    lremAsync = pooledFunctionFactory(client.lrem);
    zremAsync = pooledFunctionFactory(client.zrem);
    hmsetAsync = pooledFunctionFactory(client.hmset)
    hgetAllAsync = pooledFunctionFactory(client.hgetall);
    keysAsync = pooledFunctionFactory(client.keys);
    saddAsync = pooledFunctionFactory(client.sadd);
    sremAsync = pooledFunctionFactory(client.srem);
    smembersAsync = pooledFunctionFactory(client.smembers);
    existsAsyncWithNumber = pooledFunctionFactory(client.exists);
    expireAsync = pooledFunctionFactory(client.expire);
    ttlAsync = pooledFunctionFactory(client.ttl);

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
    jsonNumIncrByAsync = customPooledFunctionFactory("JSON.NUMINCRBY");
}

export const onConnectionSuccess = (callback: () => void ): void => {
    client.on('connect', callback);
}

export const onConnectionError = (callback: () => void ): void => {
    client.on('error', callback);
}

export const systemTaskKey = `${config.redis_prefix}:systemTasks`;
export const timerKey = `${config.redis_prefix}:timedTasks`;

export const contextObjectKey = {
    get: (executionArn: string): string => {
        return `${config.redis_prefix}:${executionArn}:contextObject`
    },
    is: (key: string): boolean => {
        const parts = key.split(':');
        return parts[parts.length-1] === 'contextObject';
    }
}