import { TaskState, WaitState } from "../stateMachines/stateMachine.interfaces";

export type StateInput = unknown;
export type StateOutput = unknown;
export type WaitStateTaskInfo = Task & WaitState

export interface Task {
    stateName: string,
    rawInput: StateInput,
    executionArn: string,
    stateMachineArn: string,
    previousStateName?: string
}

export type ActivityTask = Task & TaskState & {
    token: string,
    output?: Record<string, unknown>,
    status: ActivityTaskStatus,
    effectiveInput: StateInput
}

export enum ActivityTaskStatus {
    Running = 'Running',
    TimedOut = 'TimedOut',
    Waiting = 'Waiting'
}