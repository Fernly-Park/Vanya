/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { StopExecutionInput } from 'aws-sdk/clients/stepfunctions';
import { HistoryEventType, IExecution } from './execution/execution.interfaces';
import { RunningState, RunningTaskState } from './interpretor/interpretor.interfaces';
import { StateMachineStateValue } from './stateMachines/stateMachine.interfaces';

export type ActivityTaskHeartbeatInput = {stateInfo: RunningTaskState};
export type SendTaskFailureEventInput = {stateInfo: RunningTaskState, cause?: string, error?: string};
export type StopExecutionEventInput = StopExecutionInput;
export type onStateRetryInput = {stateInfo: RunningState, state: StateMachineStateValue}

type EventCallback = (...args: any[]) => Promise<unknown>;
let events: Record<string, EventCallback[]> = {};

export enum CustomEvents {
    ExecutionStarted = 'ExecutionStarted',
    ExecutionStopped = 'ExecutionStopped',
    StartListeningToEvents = 'StartListeningToEvents',
    WaitingStateDone = 'WaitingStateDone',
    TaskTimeout = 'TaskTimeout',
    StopListeningToEvents = 'StopListeningToEvents',
    WorkerOutputReceived = 'WorkerOutputReceived',
    ActivityTaskSucceeded = 'ActivityTaskSucceeded',
    ActivityTaskHeartbeat = 'ActivityTaskHeartbeat',
    ActivityTaskHeartbeatTimeout = 'ActivityTaskHeartbeatTimeout',
    SendTaskFailure = 'SendTaskFailure',
    ActivityFailure = 'ActivityFailure',
    TaskRetry = 'TaskRetry'
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
export const workerOutputReceivedEvent = factoryCustomEvent<{stateInfo: RunningTaskState}>(CustomEvents.WorkerOutputReceived);
export const activityStartedEvent = factoryCustomEvent<{stateInfo: RunningTaskState, workerName?: string}>(HistoryEventType.ActivityStarted);
export const activityTaskHeartbeat = factoryCustomEvent<ActivityTaskHeartbeatInput>(CustomEvents.ActivityTaskHeartbeat);
export const sendTaskFailureEvent = factoryCustomEvent<SendTaskFailureEventInput>(CustomEvents.SendTaskFailure);
export const stopExecutionEvent = factoryCustomEvent<StopExecutionEventInput>(CustomEvents.ExecutionStopped);