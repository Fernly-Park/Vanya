import { RunningTaskState,  ActivityTaskStatus,  RunningState } from "./task.interfaces";
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";

export const addToGeneralTaskQueue = async (task: RunningState): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}

export const addActivityTaskToActivityQueue = async (activityArn: string, input: RunningTaskState): Promise<void> => {
    const key = Redis.getActivityTaskKey(activityArn);
    await Redis.rpushAsync(key, JSON.stringify(input));
}

export const removeActivityTaskFromActivityQueue = async (activityArn: string, input: RunningTaskState): Promise<number> => {
    const key = Redis.getActivityTaskKey(activityArn);
    return await Redis.lremAsync(key, 0, JSON.stringify(input))
}


export const popActivityTask = async (activityArn: string): Promise<RunningTaskState> => {
    const key = Redis.getActivityTaskKey(activityArn);
    const result = await Redis.blpopAsync(key, config.activityTaskDefaultTimeout);
    return result ? JSON.parse(result[1]) as RunningTaskState : null;
}

export const popFromGeneralTaskQueue = async (): Promise<RunningState> => {
    const result = await Redis.blpopAsync(Redis.systemTaskKey, config.redisBlockingTimeout);
    return result ? JSON.parse(result[1]) as RunningState : null;
}

export const numberOfDelayedTask = async (): Promise<number> => {
    const key = Redis.timerKey;
    return await Redis.zcountAsync(key, '-inf', '+inf');
}

export const lengthOfGeneralTaskQueue = async (): Promise<number> => {
    return await Redis.llenAsync(Redis.systemTaskKey);
}

export const addActivityTaskKeyValue = async (task: RunningTaskState): Promise<void> => {
    const key = Redis.getActivityTaskInProgressKey(task.token);
    await Redis.setAsync(key, JSON.stringify(task));
}

export const retrieveActivityTaskInProgress = async (token: string): Promise<RunningTaskState> => {
    const key = Redis.getActivityTaskInProgressKey(token);
    const toReturn = await Redis.getAsync(key);
    return toReturn ? JSON.parse(toReturn) as RunningTaskState : null;
}

export const modifyActivityTaskStatus = async (token: string, newStatus: ActivityTaskStatus, previousEventId?: number): Promise<void> => {
    const key = Redis.getActivityTaskInProgressKey(token);
    await Redis.watchAsync(key, (watcher) => {
        return new Promise((resolve, reject) => {
            watcher.get(key, (err, activityTaskStringified) => {
                if (err) return reject (err);
                const activityTask = JSON.parse(activityTaskStringified) as RunningTaskState;
                if (activityTask.status === ActivityTaskStatus.TimedOut) {
                    return reject (err);
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