import { TaskState, WaitState } from "../stateMachines/stateMachine.interfaces";

export type StateInput = unknown;
export type StateOutput = unknown;
export type WaitStateTaskInfo = Task & WaitState

export interface Task {
    stateName: string,
    input: StateInput,
    executionArn: string,
    stateMachineArn: string,
    previousStateName?: string
}

export type ActivityTask = Task & TaskState & {
    token: string
}