import { Task } from "./task.interfaces";
import * as Redis from '@App/modules/database/redis';

export const addToGeneralTaskQueue = async (task: Task): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}

export const popFromGeneralTaskQueue = async (): Promise<Task> => {
    const result = await Redis.blpopAsync(Redis.systemTaskKey, 0);
    return JSON.parse(result[1]) as Task;
}

export const lengthOfGeneralTaskQueue = async (): Promise<number> => {
    return await Redis.llenAsync(Redis.systemTaskKey);
}