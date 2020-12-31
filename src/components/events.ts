/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Logger } from '@App/modules';
import { StopExecutionInput } from 'aws-sdk/clients/stepfunctions';
import { IExecution } from './execution/execution.interfaces';
import { RunningState, RunningTaskState, StateOutput } from './interpretor/interpretor.interfaces';
import { StateMachineStateValue } from './stateMachines/stateMachine.interfaces';

export type InterpretorEventInput = {stateInfo?: RunningState, token?: string}
export type ActivityTaskHeartbeatInput = InterpretorEventInput & {stateInfo: RunningTaskState};
export type SendTaskFailureEventInput = InterpretorEventInput & {stateInfo: RunningTaskState, cause?: string, error?: string};
export type StopExecutionEventInput = StopExecutionInput;
export type onStateRetryInput = InterpretorEventInput & { state: StateMachineStateValue}
export type HandleFinishedParallelBrancheEventInput = InterpretorEventInput &{brancheIndex: number, output: StateOutput, previousEventId: number};
export type handleFinishedMapIterationEventInput = InterpretorEventInput & {brancheIndex: number, output: StateOutput, token: string, previousEventId: number};

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
    FinishedParallelBranche = 'FinishedParallelBranche',
    FinishedMapIteration = 'FinishedMapIteration',
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

export const removeListenerForEvent = (eventName: string): void => {
    events[eventName] = [];
}

export const emit = (eventName: string, input?: any): void => {
    if (!events[eventName] || events[eventName].length === 0) {
        return
    }   

    void Promise.all(events[eventName].map(x => x(input))).then().catch((err) => {
        Logger.logError(err);
    });
    return;
}

export const removeAllListeners = (): void => {
    events = {};
}

const factoryCustomEvent = <T>(eventName: string) => {
    return {
        on: (callback: (input: T) => Promise<unknown>) => {
            on(eventName, callback)
        },
        emit: (data: T): void => {
            emit(eventName, data);
        },
        removeListener: (listener: (input: T) => Promise<unknown>) => {
            removeListener(eventName, listener);
        },
        removeAllListener: () => {
            events[eventName] = [];
        }
    }
}

export const executionStartedEvent = factoryCustomEvent<IExecution>(CustomEvents.ExecutionStarted);
export const finishedParallelBranche = factoryCustomEvent<HandleFinishedParallelBrancheEventInput>(CustomEvents.FinishedParallelBranche);
export const finishedMapIteration = factoryCustomEvent<handleFinishedMapIterationEventInput>(CustomEvents.FinishedMapIteration);