import { ExecutionInput } from "../execution/execution.interfaces";

export interface ContextObject {
    Execution: {
        Id: string,
        Input: ExecutionInput,
        StartTime: Date | number,
        Name: string,
        RoleArn: string
    },
    State?: ContextObjectEnteredState,
    StateMachine: {
        Id: string,
        Name: string
    },
    Task?: {
        Token: string
    },
    Map?: {
        Item : {
            Index: number,
            Value: string
        }
    }
}

export type ContextObjectEnteredState = {
    EnteredTime: Date | string,
    Name: string,
    RetryCount?: number
}