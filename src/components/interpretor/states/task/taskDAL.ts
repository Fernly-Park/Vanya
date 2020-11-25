
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";
import { ActivityTaskStatus, RunningTaskState } from '../../interpretor.interfaces';

export const addActivityTask = async (activityArn: string, task: RunningTaskState): Promise<void> => {
    await addTaskStateInfo(task);
    await addTaskToActivityQueue(activityArn, task);
}


const addTaskStateInfo = async (task: RunningTaskState): Promise<void> => {
    const key = Redis.getRunningTaskStateKey(task.token);
    await Redis.setAsync(key, JSON.stringify(task));
    await addToCurrentlyRunningState({executionArn: task.executionArn, redisKeyToAdd: key});
}

const addToCurrentlyRunningState = async (req: {executionArn: string, redisKeyToAdd: string}): Promise<void> => {
    const key = Redis.getCurrentlyRunningStateKey(req.executionArn);
    await Redis.saddAsync(key, req.redisKeyToAdd);
}

export const deleteActivityTask = async (req: {executionArn: string, taskToken: string}): Promise<void> => {
    const key = Redis.getRunningTaskStateKey(req.taskToken);
    await Redis.delAsync(key);
    await removeFromCurrentlyRunningState({executionArn: req.executionArn, redisKeyToRemove: key});
}

const removeFromCurrentlyRunningState = async (req: {executionArn: string, redisKeyToRemove: string}): Promise<void> => {
    const key = Redis.getCurrentlyRunningStateKey(req.executionArn);
    await Redis.sremAsync(key, req.redisKeyToRemove);
}

const addTaskToActivityQueue = async (activityArn: string, input: RunningTaskState): Promise<void> => {
    const key = Redis.getActivityTaskKey(activityArn);
    await Redis.rpushAsync(key, JSON.stringify(input));
}

export const retrieveActivityTaskInProgress = async (token: string): Promise<RunningTaskState> => {
    const key = Redis.getRunningTaskStateKey(token);
    const toReturn = await Redis.getAsync(key);
    return toReturn ? JSON.parse(toReturn) as RunningTaskState : null;
}

export const modifyActivityTaskStatus = async (token: string, newStatus: ActivityTaskStatus, previousEventId?: number): Promise<void> => {
    const key = Redis.getRunningTaskStateKey(token);
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
    if (newStatus === ActivityTaskStatus.TimedOut) {
        await Redis.expireAsync(key, config.taskTokenTimeoutSeconds)
    }
}


export const popActivityTask = async (activityArn: string): Promise<RunningTaskState> => {
    const key = Redis.getActivityTaskKey(activityArn);
    const result = await Redis.blpopAsync(key, config.activityTaskDefaultTimeout);
    return result ? JSON.parse(result[1]) as RunningTaskState : null;
}
