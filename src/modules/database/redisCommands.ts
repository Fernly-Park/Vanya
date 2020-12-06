/* eslint-disable @typescript-eslint/unbound-method */
import redis, { RedisClient } from 'redis';
import genericPool from 'generic-pool';
import { promisify } from 'util';

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


// eslint-disable-next-line @typescript-eslint/ban-types
const pooledFunctionFactory = (func: Function, pool: genericPool.Pool<redis.RedisClient>,) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (...args :any) => {
        const connection = await pool.acquire();
        // eslint-disable-next-line @typescript-eslint/ban-types
        const funcAsync: Function = promisify(func).bind(connection);

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return await funcAsync(...args);
        } finally {
            await pool.release(connection);
        }
    }
}

export const initializeCommands = (pool: genericPool.Pool<redis.RedisClient>, client: RedisClient): void => {
    getAsync = pooledFunctionFactory(client.get, pool)
    setAsync = pooledFunctionFactory(client.set, pool)
    delAsync = pooledFunctionFactory(client.del, pool)
    rpushAsync = pooledFunctionFactory(client.rpush, pool)
    flushallAsync = pooledFunctionFactory(client.flushall, pool)
    llenAsync = pooledFunctionFactory(client.llen, pool)
    lpopAsync = pooledFunctionFactory(client.lpop, pool)
    blpopAsync = pooledFunctionFactory(client.blpop, pool)
    hsetAsync = pooledFunctionFactory(client.HSET, pool)
    hgetAsync = pooledFunctionFactory(client.HGET, pool)
    hdelAsync = pooledFunctionFactory(client.HDEL, pool)
    incrAsync = pooledFunctionFactory(client.incr, pool);
    lrangeAsync = pooledFunctionFactory(client.lrange, pool);
    zaddAsync = pooledFunctionFactory(client.zadd, pool);
    zrangebyscoreAsync = pooledFunctionFactory(client.zrangebyscore, pool);
    zremrangebyscoreAsync = pooledFunctionFactory(client.zremrangebyscore, pool);
    zcountAsync = pooledFunctionFactory(client.zcount, pool);
    lremAsync = pooledFunctionFactory(client.lrem, pool);
    zremAsync = pooledFunctionFactory(client.zrem, pool);
    hmsetAsync = pooledFunctionFactory(client.hmset, pool)
    hgetAllAsync = pooledFunctionFactory(client.hgetall, pool);
    keysAsync = pooledFunctionFactory(client.keys, pool);
    saddAsync = pooledFunctionFactory(client.sadd, pool);
    sremAsync = pooledFunctionFactory(client.srem, pool);
    smembersAsync = pooledFunctionFactory(client.smembers, pool);
    existsAsyncWithNumber = pooledFunctionFactory(client.exists, pool);
    expireAsync = pooledFunctionFactory(client.expire, pool);
    ttlAsync = pooledFunctionFactory(client.ttl, pool);

    watchAsync = async (keyToWatch: string, callback: (watcher: redis.RedisClient) => Promise<string[]>) => {
        const watcher = await pool.acquire();
        try {
            const watchAsync = promisify(watcher.watch).bind(watcher) as (key: string) => Promise<'OK'>;
            await watchAsync(keyToWatch);
            return await callback(watcher);
        } finally {
            await pool.release(watcher);
        }

    }
    jsonsetAsync = pooledFunctionFactory(client.json_set, pool)
    jsongetAsync = pooledFunctionFactory(client.json_get, pool)
    jsondelAsync = pooledFunctionFactory(client.json_del, pool)
    jsonNumIncrByAsync = pooledFunctionFactory(client.json_numincrby, pool)
}
