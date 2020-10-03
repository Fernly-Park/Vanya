/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { HistoryEventType } from './execution/execution.interfaces';
import { StateType } from './stateMachines/stateMachine.interfaces';
import { ActivityTask, WaitStateTaskInfo } from './task/task.interfaces';

export type StateEnteredEventInput = {executionArn: string, stateName: string, stateType: StateType, input: unknown};
export type ProcessTaskDoneInput = ActivityTask;
export type StateExitedEventInput =  {executionArn: string, stateName: string, output: unknown, stateType: StateType};
export type ActivityScheduledEventInput = {executionArn: string, heartbeatSeconds: number, input: unknown, resource: string, timeoutSeconds: number};
export type ActivityStartedEventInput = {executionArn: string, workerName?: string};
export type ActivitySucceededEventInput = {executionArn: string, output: unknown};
export type ExecutionFailedEventInput = {executionArn: string, stateName: string, description: string};
export type ExecutionSucceededEventInput = {executionArn: string, result: unknown};

type EventCallback = (...args: any[]) => Promise<void>;
let events: Record<string, EventCallback[]> = {};

export enum CustomEvents {
    StartListeningToEvents = 'StartListeningToEvents',
    WaitingStateDone = 'WaitingStateDone',
    StopListeningToEvents = 'StopListeningToEvents',
    ActivityTaskSucceeded = 'ActivityTaskSucceeded'
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
        on: (callback: (input: T) => Promise<void>) => {
            on(eventName, callback)
        },
        emit: async (data: T): Promise<void> => {
            await emit(eventName, data);
        },
        removeListener: (listener: (input: T) => Promise<void>) => {
            removeListener(eventName, listener);
        }
    }
}

export const stateEnteredEvent = factoryCustomEvent<StateEnteredEventInput>(HistoryEventType.StateEntered);
export const activityTaskSucceededEvent = factoryCustomEvent<ActivityTask>(CustomEvents.ActivityTaskSucceeded);
export const stateExitedEvent = factoryCustomEvent<StateExitedEventInput>(HistoryEventType.StateExited);
export const activityScheduledEvent = factoryCustomEvent<ActivityScheduledEventInput>(HistoryEventType.ActivityScheduled);
export const activityStartedEvent = factoryCustomEvent<ActivityStartedEventInput>(HistoryEventType.ActivityStarted);
export const activitySucceededEvent = factoryCustomEvent<ActivitySucceededEventInput>(HistoryEventType.ActivitySucceeded);
export const executionFailedEvent = factoryCustomEvent<ExecutionFailedEventInput>(HistoryEventType.ExecutionFailed);
export const executionSucceededEvent = factoryCustomEvent<ExecutionSucceededEventInput>(HistoryEventType.ExecutionSucceeded);
