import * as TimerDAL from './timerDAL';
import { sleep } from '@Tests/testHelper';
import config from '@App/config';
import { WaitStateTaskInfo } from '../task/task.interfaces';
import { TimedTask, TimedTaskType } from './timer.interfaces';


let timerActive = true;
export const startTimerPoll = async (): Promise<void> => {
    timerActive = true;
    while(timerActive) {
        const now = new Date();
        const timers = await TimerDAL.getAndDeleteTimedTasks(now.getTime());
        if(timers && timers.length > 0) {
            for(const stringifiedTimer of timers) {
                const timer = JSON.parse(stringifiedTimer) as TimedTask;
                await TimerDAL.addToWaitingStateDone(timer)
            }
        } else {
            await sleep(config.timerPollIntervalMs);
        }
    }
}

export const addWaitTask = async (time: Date, task: WaitStateTaskInfo): Promise<void> => {
    const t: TimedTask = {type: TimedTaskType.WaitTask, task};
    await TimerDAL.addTimedTask(time.getTime(), t);
}

export const retrieveWaitingStateDoneBlocking = async (): Promise<WaitStateTaskInfo> => {
    return await TimerDAL.retrieveWaitingStateDoneBlocking();
}

export const stopTimerPoll = (): void => {
    timerActive = false;
}

export const numberOfTimedTask = async(): Promise<number> => {
    return await TimerDAL.numberOfTimedTask();
}

export const numberOfWaitingTaskDone = async (): Promise<number> => {
    return await TimerDAL.numberOfWaitingTaskDone();
}