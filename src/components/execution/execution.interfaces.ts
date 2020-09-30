export enum ExecutionTable {
    tableName = 'executions',
    executionArnColumn = 'executionArn',
    inputColumn = 'input',
    nameColumn = 'name',
    outputColumn = 'output',
    startDateColumn = 'startDate',
    stateMachineArnColumn = 'stateMachineArn',
    statusColumn = 'status',
    stopDateColumn = 'stopDate'
}

export enum ExecutionEventTable {
    tableName = 'executionEvents',
    executionArnColumn = 'executionArn',
    idColumn = 'id',
    timestampColumn = 'timestamp',
    typeColumn = 'type',
    eventColumn = 'event'
}

export type ExecutionInput = Record<string, unknown> | unknown[];
export interface IExecution {
    executionArn: string,
    input: ExecutionInput,
    name: string,
    output: string,
    startDate: Date,
    stateMachineArn: string,
    status: ExecutionStatus,
    stopDate: Date
}

export enum ExecutionStatus {
    running = 'RUNNING',
    succeeded = 'SUCCEEDED',
    failed = 'FAILED',
    timedOut = 'TIMED_OUT',
    aborted = 'ABORTED'
}


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

export enum HistoryEventType {
    ActivityScheduled = 'ActivityScheduled',
    ExecutionStarted = 'ExecutionStarted',
    ActivityScheduleFailed = 'ActivityScheduleFailed',
    ActivityStarted = 'ActivityStarted',
    ActivitySucceeded = 'ActivitySucceeded',
    ActivityTimedOut = 'ActivityTimedOut',
    ExecutionFailed = 'ExecutionFailed',
    ExecutionSucceeded = 'ExecutionSucceeded',
    StateEntered = 'StateEntered',
    StateExited = 'StateExited'
}