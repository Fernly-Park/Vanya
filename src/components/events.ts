/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { HistoryEventType, IExecution } from './execution/execution.interfaces';
import { RunningTaskState } from './task/task.interfaces';

export type ProcessTaskDoneInput = RunningTaskState;
export type ActivityTaskHeartbeatInput = RunningTaskState;
export type SendTaskFailureEventInput = {activityTask: RunningTaskState, cause?: string, error?: string};

type EventCallback = (...args: any[]) => Promise<unknown>;
let events: Record<string, EventCallback[]> = {};

export enum CustomEvents {
    ExecutionStarted = 'ExecutionStarted',
    StartListeningToEvents = 'StartListeningToEvents',
    WaitingStateDone = 'WaitingStateDone',
    TaskTimeout = 'TaskTimeout',
    StopListeningToEvents = 'StopListeningToEvents',
    WorkerOutputReceived = 'WorkerOutputReceived',
    ActivityTaskSucceeded = 'ActivityTaskSucceeded',
    ActivityTaskHeartbeat = 'ActivityTaskHeartbeat',
    ActivityTaskHeartbeatTimeout = 'ActivityTaskHeartbeatTimeout',
    SendTaskFailure = 'SendTaskFailure',
    ActivityFailure = 'ActivityFailure'
}

export const on = (eventName: string, callback: EventCallback): void => {
    if (!events[eventName]) {
        events[eventName] = [];
    }

    events[eventName].push(callback);
}
export const removeListener = (eventName: string, listener: EventCallback): void => {
    if (!events[eventName]) {
        return;
    }

    const index = events[eventName]?.indexOf(listener);
    if (index > -1) {
        events[eventName].splice(index, 1)
    }
}

export const emit = async (eventName: string, input?: any): Promise<boolean> => {
    if (!events[eventName] || events[eventName].length === 0) {
        return Promise.resolve(false);
    }   

    await Promise.all(events[eventName].map(x => x(input)));
    return true;
}

export const removeAllListeners = (): void => {
    events = {};
}

const factoryCustomEvent = <T>(eventName: string) => {
    return {
        on: (callback: (input: T) => Promise<unknown>) => {
            on(eventName, callback)
        },
        emit: async (data: T): Promise<void> => {
            await emit(eventName, data);
        },
        removeListener: (listener: (input: T) => Promise<unknown>) => {
            removeListener(eventName, listener);
        }
    }
}

export const executionStartedEvent = factoryCustomEvent<IExecution>(CustomEvents.ExecutionStarted);
export const workerOutputReceivedEvent = factoryCustomEvent<RunningTaskState>(CustomEvents.WorkerOutputReceived);
export const activityTaskSucceededEvent = factoryCustomEvent<RunningTaskState>(CustomEvents.ActivityTaskSucceeded)
export const activityStartedEvent = factoryCustomEvent<{task: RunningTaskState, workerName?: string}>(HistoryEventType.ActivityStarted);
export const activityTaskHeartbeat = factoryCustomEvent<ActivityTaskHeartbeatInput>(CustomEvents.ActivityTaskHeartbeat);
export const sendTaskFailureEvent = factoryCustomEvent<SendTaskFailureEventInput>(CustomEvents.SendTaskFailure);