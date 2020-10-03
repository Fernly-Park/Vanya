import { ActivityTask, StateInput, Task } from "./task.interfaces";
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";

export const addToGeneralTaskQueue = async (task: Task): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}

export const addActivityTaskToActivityQueue = async (activityArn: string, input: ActivityTask): Promise<void> => {
    const key = Redis.getActivityTaskKey(activityArn);
    await Redis.rpushAsync(key, JSON.stringify(input));
}

export const popActivityTask = async (activityArn: string): Promise<ActivityTask> => {
    const key = Redis.getActivityTaskKey(activityArn);
    const result = await Redis.blpopAsync(key, config.activityTaskDefaultTimeout);
    return result ? JSON.parse(result[1]) as ActivityTask : null;
}

export const popFromGeneralTaskQueue = async (): Promise<Task> => {
    const result = await Redis.blpopAsync(Redis.systemTaskKey, config.redisBlockingTimeout);
    return result ? JSON.parse(result[1]) as Task : null;
}

export const numberOfDelayedTask = async (): Promise<number> => {
    const key = Redis.timerKey;
    return await Redis.zcountAsync(key, '-inf', '+inf');
}

export const lengthOfGeneralTaskQueue = async (): Promise<number> => {
    return await Redis.llenAsync(Redis.systemTaskKey);
}

export const addActivityTaskToInProgress = async (task: ActivityTask): Promise<void> => {
    const key = Redis.getActivityTaskInProgressKey(task.token);
    await Redis.setAsync(key, JSON.stringify(task));
}

export const retrieveActivityTaskInProgress = async (token: string): Promise<ActivityTask> => {
    const key = Redis.getActivityTaskInProgressKey(token);
    const toReturn = await Redis.getAsync(key);
    return toReturn ? JSON.parse(toReturn) as ActivityTask : null;
}