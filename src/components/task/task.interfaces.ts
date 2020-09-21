import { WaitState } from "../stateMachines/stateMachine.interfaces";

export type TaskInput = unknown;
export type TaskOutput = unknown;
export type TimerInfo = Task & WaitState & {previousEventId: number}

export interface Task {
    stateName: string,
    input: TaskInput,
    executionArn: string,
    stateMachineArn: string,
    previousEventId: number
}