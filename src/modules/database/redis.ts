/* eslint-disable @typescript-eslint/unbound-method */

import redis from 'redis';
import { promisify } from 'util';
import config from '@App/config';
import genericPool from 'generic-pool';

export const client = redis.createClient();
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

export const getAsync = pooledFunctionFactory(client.get) as (arg1: string) => Promise<string>;
export const setAsync = pooledFunctionFactory(client.set) as (key: string, value: string) => Promise<boolean>;
export const delAsync = pooledFunctionFactory(client.del) as (key: string) => Promise<void>;
export const rpushAsync = pooledFunctionFactory(client.rpush) as (key: string, ...args: string[]) => Promise<number>;
export const flushallAsync = pooledFunctionFactory(client.flushall) as () => Promise<unknown>;
export const llenAsync = pooledFunctionFactory(client.llen) as(key: string) => Promise<number>;
export const lpopAsync = pooledFunctionFactory(client.lpop) as (key: string) => Promise<string>;
export const blpopAsync = pooledFunctionFactory(client.blpop) as (key: string, timeout: number) => Promise<[string, string]>;
export const hsetAsync = pooledFunctionFactory(client.HSET) as (key: string, field: string, value: string) => Promise<void>
export const hgetAsync = pooledFunctionFactory(client.HGET) as (key: string, field: string) => Promise<string>
export const hdelAsync = pooledFunctionFactory(client.HDEL) as (key: string, field: string) => Promise<void>

export const jsonsetAsync = customPooledFunctionFactory("JSON.SET") as (key: string, path: string, json: string) => Promise<boolean>;
export const jsongetAsync = customPooledFunctionFactory("JSON.GET") as (key: string, path?: string) => Promise<string>;
export const jsondelAsync = customPooledFunctionFactory("JSON.DEL") as (key: string, path?: string) => Promise<void>;

export const quitAsync = async (): Promise<void> => {
    await connectionPool.drain();
    await connectionPool.clear();
    await promisify(client.quit).bind(client)();
}


export const systemTaskKey = `${config.redis_prefix}:systemTasks`;

export const getContextObjectKey = (executionArn: string): string => {
    return `${config.redis_prefix}:${executionArn}:contextObject`
}

export const getStateMachineStatesKey = (stateMachineArn: string): string => {
    return `${config.redis_prefix}:${stateMachineArn}:states`
}

