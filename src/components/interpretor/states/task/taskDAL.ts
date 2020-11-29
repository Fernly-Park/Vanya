
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";
import { ActivityTaskStatus, RunningTaskState } from '../../interpretor.interfaces';
import * as RedisKey from '@App/modules/database/redisKeys'

export const addActivityTask = async (activityArn: string, task: RunningTaskState): Promise<void> => {
    await addTaskStateInfo(task);
    await addTaskToActivityQueue(activityArn, task);
}


const addTaskStateInfo = async (task: RunningTaskState): Promise<void> => {
    const key = RedisKey.runningTaskStateKey.get(task.token);
    await Redis.setAsync(key, JSON.stringify(task));
}

export const deleteActivityTask = async (req: {executionArn: string, taskToken: string}): Promise<void> => {
    const key = RedisKey.runningTaskStateKey.get(req.taskToken);
    await Redis.delAsync(key);
}

const addTaskToActivityQueue = async (activityArn: string, input: RunningTaskState): Promise<void> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    await Redis.rpushAsync(key, JSON.stringify(input));
}

export const retrieveActivityTaskInProgress = async (token: string): Promise<RunningTaskState> => {
    const key = RedisKey.runningTaskStateKey.get(token);
    const toReturn = await Redis.getAsync(key);
    return toReturn ? JSON.parse(toReturn) as RunningTaskState : null;
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
    if (newStatus === ActivityTaskStatus.TimedOut) {
        await Redis.expireAsync(key, config.taskTokenTimeoutSeconds)
    }
}


export const popActivityTask = async (activityArn: string): Promise<RunningTaskState> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    const result = await Redis.blpopAsync(key, config.activityTaskDefaultTimeout);
    return result ? JSON.parse(result[1]) as RunningTaskState : null;
}
