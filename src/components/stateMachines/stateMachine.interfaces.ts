export enum StateMachineTable {
    tableName = 'stateMachines',
    arnColumn = 'arn',
    definitionColumn = 'definition',
    createDateColumn = 'creationDate'
}

export interface IStateMachineDefinition {
    Comment: string
    StartAt: string
    Version: string
    TimeoutSeconds: number
    States: StateMachineState[]
}

export interface StateMachineState {
    Type: string,
    Comment?: string,
}

export interface PassState extends StateMachineState{
    InputPath?: string
    OutputPath?: string
    Parameters: unknown
    ResultPath?: string
    Next?: string
    End?: boolean
    Result?: unknown
}

export interface TaskState extends StateMachineState {
    Resource: string
    TimeoutSeconds?: number,
    HeartbeatSeconds?: number,
    InputPath?: string,
    OutputPath?: string,
    ResultPath?: string,
    Parameters: unknown,
    Next?: string,
    End?: boolean,
    Retry?: Retrier[],
    Catch?: Catcher[]
}

export interface ChoiceState extends StateMachineState {
    Choice: unknown[]
    InputPath?: string
    OutputPath?: string
}

export interface WaitState extends StateMachineState {
    Seconds?: number
    SecondsPath?: string
    Timestamp?: Date
    TimestampPath?: string
    InputPath?: string
    OutputPath?: string
    Next?: string
    End?: boolean
}

export interface SucceedState extends StateMachineState {
    InputPath?: string
    OutputPath?: string
}

export interface FailState extends StateMachineState {
    Error: string
    Cause: string
}

export interface ParallelState extends StateMachineState {
    Branches: IStateMachineDefinition[]
    TimeoutSeconds?: number,
    HeartbeatSeconds?: number,
    InputPath?: string,
    OutputPath?: string,
    ResultPath?: string,
    Parameters: unknown,
    Next?: string,
    End?: boolean,
    Retry?: Retrier[],
    Catch?: Catcher[]
}

export interface MapState extends StateMachineState {
    Iterator: IStateMachineDefinition,
    ItemsPath?: string,
    MaxConcurrency?: number,
    TimeoutSeconds?: number,
    HeartbeatSeconds?: number,
    InputPath?: string,
    OutputPath?: string,
    ResultPath?: string,
    Parameters: unknown,
    Next?: string,
    End?: boolean,
    Retry?: Retrier[],
    Catch?: Catcher[]
}

export interface Retrier {
    ErrorEquals: string[]
    IntervalSeconds?: number
    MaxAttempts: number
    BackoffRate: number
}

export interface Catcher {
    ErrorEquals: string[],
    Next: string,
    ResultPath?: string
}

export enum StateType {
    Pass = 'Pass',
    Task = 'Task',
    Choice = 'Choice',
    Wait = 'Wait',
    Succeed = 'Succeed',
    Fail = 'Fail',
    Parallel = 'Parallel',
    Map = 'Map'
}