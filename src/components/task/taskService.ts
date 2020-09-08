import { Task } from "./task.interfaces";
import * as TaskDAL from "./taskDAL";

export const addTask = async (task: Task): Promise<void> => {
    // TODO 
    await TaskDAL.addToGeneralTaskQueue(task);
}

export const getGeneralTask = async (): Promise<Task> => {
    return await TaskDAL.popFromGeneralTaskQueue();
}

export const numberOfGeneralTask = async (): Promise<number> => {
    return await TaskDAL.lengthOfGeneralTaskQueue();
}