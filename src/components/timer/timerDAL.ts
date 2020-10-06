import * as Redis from '@App/modules/database/redis';
import { TimedTask } from './timer.interfaces';

export const addTimedTask = async (until: Date, task: TimedTask): Promise<void> => {
    const score = until.getTime();
    const toAdd: TimedTask = {task: task.task, eventNameForCallback: task.eventNameForCallback};
    await Redis.zaddAsync(Redis.timerKey, score, JSON.stringify(toAdd));
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
                        reject();
                    } else {
                        resolve(results)
                    }
                })
        });
    });
    return toReturn ? (toReturn[0] as unknown as string[]): [];
}

export const deleteTimedTask = async (task: TimedTask): Promise<number> => {
    const toRemove: TimedTask = {task: task.task, eventNameForCallback: task.eventNameForCallback};
    return await Redis.zremAsync(Redis.timerKey, JSON.stringify(toRemove));
}

export const numberOfTimedTask = async (): Promise<number> => {
    const key = Redis.timerKey;
    return await Redis.zcountAsync(key, '-inf', '+inf');
}
