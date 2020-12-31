import { StateType } from "../stateMachines/stateMachine.interfaces";

export type StateInput = unknown;
export type StateOutput = unknown;

export interface RunningState {
    stateName: string,
    rawInput: StateInput,
    stateType?: StateType,
    executionArn: string,
    stateMachineArn: string,
    previousStateName?: string,
    previousEventId: number,
    retry?: RetryInformation[],
    token?: string,
    parentInfo?: {
        parentKey: string,
        currentBranche: number
    },
}

export interface RetryInformation {
    retryIntervalSeconds: number,
    retryLeft: number
}

export type RunningTaskState = RunningState & {
    output?: Record<string, unknown>,
    status: ActivityTaskStatus,
    effectiveInput: StateInput,
    heartbeatSeconds?: number,
    timeoutSeconds?: number
}

export type RunningWaitState = RunningState & {
    waitUntil: Date
};

export type RunningParallelState = RunningState & {
    numberOfBranchesLeft: number
    output: StateOutput[]
}

export enum ActivityTaskStatus {
    Running = 'Running',
    TimedOut = 'TimedOut',
    Waiting = 'Waiting'
}