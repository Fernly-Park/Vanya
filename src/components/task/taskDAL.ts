import { Task, TimerInfo } from "./task.interfaces";
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";
import { watch } from "fs";

export const addToGeneralTaskQueue = async (task: Task): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}

export const addToDelayedTask = async (score: number, timerInfo: TimerInfo): Promise<void> => {
    await Redis.zaddAsync(Redis.delayedTaskKey, score, JSON.stringify(timerInfo));
}

export const popFromGeneralTaskQueue = async (): Promise<Task> => {
    const result = await Redis.blpopAsync(Redis.systemTaskKey, config.redisBlockingTimeout);
    return result ? JSON.parse(result[1]) as Task : null;
}

export const retrieveAndDeleteDelayedTaskUpTo = async (score: number): Promise<TimerInfo[]> => {
    const key = Redis.delayedTaskKey;
    const toReturn =  await Redis.watchAsync(key, (watcher) => {
        return new Promise((resolve, reject) => {
            watcher.multi()
                .zrangebyscore(key, '-inf', score)
                .zremrangebyscore(key, '-inf', score)
                .exec((err, results) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(results)
                    }
                })
        });
    });
    return (toReturn[0] as unknown as string[]).map(x => JSON.parse(x) as TimerInfo);
}

export const deleteDelayedTaskUpTo = async (score: number): Promise<void> => {
    const key = Redis.delayedTaskKey;
    await Redis.zremrangebyscoreAsync(key, '-inf', score);
}

export const numberOfDelayedTask = async (): Promise<number> => {
    const key = Redis.delayedTaskKey;
    return await Redis.zcountAsync(key, '-inf', '+inf');
}

export const lengthOfGeneralTaskQueue = async (): Promise<number> => {
    return await Redis.llenAsync(Redis.systemTaskKey);
}