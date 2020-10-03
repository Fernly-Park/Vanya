import * as Redis from '@App/modules/database/redis';
import { TimedTask } from './timer.interfaces';

export const addTimedTask = async (until: Date, task: TimedTask): Promise<void> => {
    const score = until.getTime();
    await Redis.zaddAsync(Redis.timerKey, score, JSON.stringify(task));
}

export const getAndDeleteTimedTasks = async (time: Date): Promise<string[]> => {
    const score = time.getTime();
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
