
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";
import { ActivityTaskStatus, RunningTaskState } from '../../interpretor.interfaces';
import * as RedisKey from '@App/modules/database/redisKeys'

export const addTaskToActivityQueue = async (activityArn: string, taskInfo: RunningTaskState): Promise<void> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    await Redis.rpushAsync(key, JSON.stringify(taskInfo));
}


export const modifyActivityTaskStatus = async (token: string, newStatus: ActivityTaskStatus, previousEventId?: number): Promise<void> => {
    const key = RedisKey.runningTaskStateKey.get(token);
    await Redis.watchAsync(key, (watcher) => {
        return new Promise((resolve, reject) => {
            watcher.get(key, (err, activityTaskStringified) => {
                if (err) return reject (err)
            
                const activityTask = JSON.parse(activityTaskStringified) as RunningTaskState;
                if (activityTask.status === ActivityTaskStatus.TimedOut) {
                    return resolve();
                }
                activityTask.status = newStatus;
                activityTask.previousEventId = previousEventId == null ? activityTask.previousEventId : previousEventId;
                watcher.multi()
                .set(key, JSON.stringify(activityTask))
                .exec((err, results) => {
                    if (err || results === null) {
                        reject('Concurrency error : the activity task status is already Timeout');
                    } else {
                        resolve(results)
                    }
                })
            });
        });
    });

}


export const popActivityTask = async (activityArn: string): Promise<RunningTaskState> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    const result = await Redis.blpopAsync(key, config.activityTaskDefaultTimeout);
    return result ? JSON.parse(result[1]) as RunningTaskState : null;
}
