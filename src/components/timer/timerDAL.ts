import config from '@App/config';
import * as Redis from '@App/modules/database/redis';
import { WaitStateTaskInfo } from '../task/task.interfaces';
import { TimedTask, TimedTaskType } from './timer.interfaces';

export const addTimedTask = async (score: number, task: TimedTask): Promise<void> => {
    let key: string;
    switch(task.type) {
        case TimedTaskType.WaitTask:
            key = Redis.waitingStatesKey;
            break;
    }

    await Redis.zaddAsync(Redis.timerKey, score, JSON.stringify(task));
}

export const addToWaitingStateDone = async (task: TimedTask): Promise<void> => {
    const key = Redis.waitingStatesKey;
    await Redis.rpushAsync(key, JSON.stringify(task.task));
}

export const retrieveWaitingStateDoneBlocking = async (): Promise<WaitStateTaskInfo> => {
    const result = await Redis.blpopAsync(Redis.waitingStatesKey, config.redisBlockingTimeout);
    return result ? JSON.parse(result[1]) as WaitStateTaskInfo : null;
}

export const getAndDeleteTimedTasks = async (score: number): Promise<string[]> => {
    const key = Redis.timerKey;
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
    return (toReturn[0] as unknown as string[]);
}


export const numberOfTimedTask = async (): Promise<number> => {
    const key = Redis.timerKey;
    return await Redis.zcountAsync(key, '-inf', '+inf');
}

export const numberOfWaitingTaskDone = async (): Promise<number> => {
    const key = Redis.waitingStatesKey;
    return await Redis.llenAsync(key);
}
