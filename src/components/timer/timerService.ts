import * as TimerDAL from './timerDAL';
import { sleep } from '@Tests/testHelper';
import config from '@App/config';
import { TimedTask } from './timer.interfaces';
import * as Event from '../events';

let timerActive = true;
export const startTimerPoll = async (): Promise<void> => {
    timerActive = true;
    while(timerActive) {
        const now = new Date();
        const timers = await TimerDAL.getAndDeleteTimedTasks(now);
        if(timers && timers.length > 0) {
            for(const stringifiedTimer of timers) {
                const timer = JSON.parse(stringifiedTimer) as TimedTask;
                Event.emit(timer.eventNameForCallback, timer.task);
            }
        } else {
            await sleep(config.timerPollIntervalMs);
        }
    }
}

export const addTimedTask = async (req: {until: Date, timedTask: TimedTask}): Promise<void> => {
    await TimerDAL.addTimedTask(req.until, req.timedTask)
}

export const removeTimedTask = async (task: TimedTask): Promise<void> => {
    await TimerDAL.deleteTimedTask(task);
};

export const stopTimerPoll = (): void => {
    timerActive = false;
}

export const numberOfTimedTask = async(): Promise<number> => {
    return await TimerDAL.numberOfTimedTask();
}