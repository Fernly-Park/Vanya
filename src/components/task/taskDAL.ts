import { Task } from "./task.interfaces";
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";

export const addToGeneralTaskQueue = async (task: Task): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}

export const popFromGeneralTaskQueue = async (): Promise<Task> => {
    const result = await Redis.blpopAsync(Redis.systemTaskKey, config.redisBlockingTimeout);
    return result ? JSON.parse(result[1]) as Task : null;
}

export const lengthOfGeneralTaskQueue = async (): Promise<number> => {
    return await Redis.llenAsync(Redis.systemTaskKey);
}