export type TimedTask = {type: TimedTaskType, task: unknown};

export enum TimedTaskType {
    WaitTask = 'WaitTask'
}