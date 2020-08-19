/* eslint-disable @typescript-eslint/unbound-method */

import redis from 'redis';
import { promisify } from 'util';
import config from '@App/config';
import genericPool from 'generic-pool';

const client = redis.createClient();
const connectionPool = genericPool.createPool({
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

export const onConnectionSuccess = (callback: () => void ): void => {
    client.on('connect', callback);
}

export const onConnectionError = (callback: () => void ): void => {
    client.on('error', callback);
}

// eslint-disable-next-line @typescript-eslint/ban-types
const pooledFunctionFactory = (func: Function) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (...args :any) => {
        const connection = await connectionPool.acquire();
        // eslint-disable-next-line @typescript-eslint/ban-types
        const funcAsync: Function= promisify(func).bind(connection);
        const toReturn = await funcAsync(args);
        await connectionPool.release(connection);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return toReturn;
    }
}
export const getAsync = pooledFunctionFactory(client.get) as (arg1: string) => Promise<string>;
export const rpushAsync = pooledFunctionFactory(client.rpush) as (key: string, ...args: string[]) => Promise<number>;
export const flushallAsync= pooledFunctionFactory(client.flushall) as () => Promise<unknown>;
export const llenAsync = pooledFunctionFactory(client.llen) as(key: string) => Promise<number>;
export const lpopAsync = pooledFunctionFactory(client.lpop) as (key: string) => Promise<string>;
export const blpopAsync = pooledFunctionFactory(client.blpop) as (key: string, timeout: number) => Promise<[string, string]>;
export const quitAsync = async (): Promise<void> => {
    await connectionPool.drain();
    await connectionPool.clear();
    await promisify(client.quit).bind(client)();
}

export const systemTaskKey = `${config.redis_prefix}:systemTasks`;

