export type StateInput = unknown;
export type StateOutput = unknown;

export interface RunningState {
    stateName: string,
    rawInput: StateInput,
    executionArn: string,
    stateMachineArn: string,
    previousStateName?: string,
    previousEventId: number,
    retry?: RetryInformation[]
}

export interface RetryInformation {
    retryIntervalSeconds: number,
    retryLeft: number
}

export type RunningTaskState = RunningState & {
    token: string,
    output?: Record<string, unknown>,
    status: ActivityTaskStatus,
    effectiveInput: StateInput,
    heartbeatSeconds?: number,
    timeoutSeconds?: number
}

export enum ActivityTaskStatus {
    Running = 'Running',
    TimedOut = 'TimedOut',
    Waiting = 'Waiting'
}