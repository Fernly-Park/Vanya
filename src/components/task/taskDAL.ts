import { Task } from "./task.interfaces";
import * as Redis from '@App/modules/database/redis';

export const addToGeneralTaskQueue = async (task: Task): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}