import { Task, TimerInfo } from "./task.interfaces";
import * as TaskDAL from "./taskDAL";

export const addTask = async (task: Task): Promise<void> => {
    // TODO 
    await TaskDAL.addToGeneralTaskQueue(task);
}

export const addToDelayedTask = async (expiredTime: Date, timerInfo: TimerInfo): Promise<void> => {
    await TaskDAL.addToDelayedTask(expiredTime.getTime(), timerInfo);
}

export const getGeneralTaskBlocking = async (): Promise<Task> => {
    return await TaskDAL.popFromGeneralTaskQueue();
}


export const numberOfGeneralTask = async (): Promise<number> => {
    return await TaskDAL.lengthOfGeneralTaskQueue();
}

export const getAndDeleteDelayedTasks = async (upTo: Date): Promise<TimerInfo[]> => {
    return await TaskDAL.retrieveAndDeleteDelayedTaskUpTo(upTo.getTime())
}

export const deleteDelayedTasks = async (upTo: Date): Promise<void> => {
    return await TaskDAL.deleteDelayedTaskUpTo(upTo.getTime());
}

export const numberOfDelayedTask = async(): Promise<number> => {
    return await TaskDAL.numberOfDelayedTask();
}