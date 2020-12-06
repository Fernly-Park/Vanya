/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/unbound-method */

import redis, { Callback } from 'redis';
import { promisify } from 'util';
import config from '@App/config';
import genericPool from 'generic-pool';
import * as RedisCommands from './redisCommands';
export * from './redisCommands';

declare module 'redis' {
    interface Commands<R> {
        json_set : (key: string, path: string, json: string, callback?: Callback<string>) => R
        json_get : (key: string, callback?: Callback<string>) => R
        json_del : (key: string, callback?: Callback<string>) => R
        json_numincrby : (key: string, path: string, number: number, callback?: Callback<string>) => R
    }
}

function addReJSONModule(redis: any) {
    const cmds = ["json.del", "json.get", "json.mget", "json.set", "json.type", "json.numincrby", "json.nummultby", 
    "json.strappend", "json.strlen", "json.arrappend", "json.arrindex", "json.arrinsert", "json.arrlen", 
    "json.arrpop", "json.arrtrim", "json.objkeys", "json.objlen", "json.debug", "json.forget", "json.resp"];
    
    cmds.forEach(function(aCmd) {
      redis.addCommand(aCmd);
    });
  }

addReJSONModule(redis);


export let client: redis.RedisClient;
let connectionPool: genericPool.Pool<redis.RedisClient>;

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
    
    RedisCommands.initializeCommands(connectionPool, client);
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