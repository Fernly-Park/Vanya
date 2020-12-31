
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";
import { ActivityTaskStatus, RunningTaskState } from '../../interpretor.interfaces';
import * as RedisKey from '@App/modules/database/redisKeys'
import { TaskTimedOutError } from '@App/errors/customErrors';

export const addTaskToActivityQueue = async (activityArn: string, taskInfo: RunningTaskState): Promise<void> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    await Redis.rpushAsync(key, JSON.stringify(taskInfo));
}


export const modifyActivityTaskStatus = async (token: string, newStatus: ActivityTaskStatus, previousEventId?: number): Promise<void> => {
    const key = RedisKey.runningTaskStateKey.get(token);

    await Redis.watchAsync(key, (watcher) => {
        return new Promise((resolve, reject) => {
            watcher.json_get(key, (err: Error, activityTaskStringified: string) => {
                if (err) return reject (err)
                const activityTask = JSON.parse(activityTaskStringified) as RunningTaskState;
                if (!activityTask || activityTask.status === ActivityTaskStatus.TimedOut) {
                    return reject(new TaskTimedOutError('Concurrency error : the activity task status is already Timeout1'));
                }
                activityTask.status = newStatus;
                watcher.multi()
                .json_set(key, '.', JSON.stringify(activityTask))
                .exec((err: Error, results: string[]) => {
                    if (err || results === null) {
                        reject(new TaskTimedOutError('Concurrency error : the activity task status is already Timeout1'));
                    } else {
                        resolve(results)
                    }
                })
            });
        });
    });


    if (previousEventId != null) {
        await Redis.jsonsetAsync(key, '.previousEventId', JSON.stringify(previousEventId))
    }
}

export const popActivityTask = async (activityArn: string): Promise<RunningTaskState> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    const result = await Redis.blpopAsync(key, config.activityTaskDefaultTimeout);
    return result ? JSON.parse(result[1]) as RunningTaskState : null;
}
