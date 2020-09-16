
export type TaskInput = unknown;
export type TaskOutput = unknown;

export interface Task {
    stateName: string,
    input: TaskInput,
    executionArn: string,
    stateMachineArn: string,
    previousEventId: number
}