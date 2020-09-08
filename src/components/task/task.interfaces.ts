
export type TaskInput = unknown;

export interface Task {
    stateName: string,
    input: TaskInput,
    executionArn: string,
    stateMachineArn: string,
}