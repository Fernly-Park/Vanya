import { TaskState, WaitState } from "../stateMachines/stateMachine.interfaces";

export type StateInput = unknown;
export type StateOutput = unknown;
export type WaitStateTaskInfo = Task & WaitState & {previousEventId: number}

export interface Task {
    stateName: string,
    input: StateInput,
    executionArn: string,
    stateMachineArn: string,
    previousEventId: number,
    previousStateName?: string
}

export type ActivityTask = Task & TaskState & {
    token: string
}