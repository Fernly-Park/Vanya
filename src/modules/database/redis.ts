/* eslint-disable @typescript-eslint/unbound-method */

import redis from 'redis';
import { promisify } from 'util';
import config from '@App/config';
import genericPool from 'generic-pool';

let client: redis.RedisClient;
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

    getAsync = pooledFunctionFactory(client.get) as (arg1: string) => Promise<string>;
    setAsync = pooledFunctionFactory(client.set) as (key: string, value: string) => Promise<boolean>;
    delAsync = pooledFunctionFactory(client.del) as (key: string) => Promise<void>;
    rpushAsync = pooledFunctionFactory(client.rpush) as (key: string, ...args: string[]) => Promise<number>;
    flushallAsync = pooledFunctionFactory(client.flushall) as () => Promise<unknown>;
    llenAsync = pooledFunctionFactory(client.llen) as(key: string) => Promise<number>;
    lpopAsync = pooledFunctionFactory(client.lpop) as (key: string) => Promise<string>;
    blpopAsync = pooledFunctionFactory(client.blpop) as (key: string, timeout: number) => Promise<[string, string]>;
    hsetAsync = pooledFunctionFactory(client.HSET) as (key: string, field: string, value: string) => Promise<void>
    hgetAsync = pooledFunctionFactory(client.HGET) as (key: string, field: string) => Promise<string>
    hdelAsync = pooledFunctionFactory(client.HDEL) as (key: string, field: string) => Promise<void>
    jsonsetAsync = customPooledFunctionFactory("JSON.SET") as (key: string, path: string, json: string) => Promise<boolean>;
    jsongetAsync = customPooledFunctionFactory("JSON.GET") as (key: string, path?: string) => Promise<string>;
    jsondelAsync = customPooledFunctionFactory("JSON.DEL") as (key: string, path?: string) => Promise<void>;
}

export const onConnectionSuccess = (callback: () => void ): void => {
    client.on('connect', callback);
}

export const onConnectionError = (callback: () => void ): void => {
    client.on('error', callback);
}




export const systemTaskKey = `${config.redis_prefix}:systemTasks`;

export const getContextObjectKey = (executionArn: string): string => {
    return `${config.redis_prefix}:${executionArn}:contextObject`
}

export const getStateMachineStatesKey = (stateMachineArn: string): string => {
    return `${config.redis_prefix}:${stateMachineArn}:states`
}

