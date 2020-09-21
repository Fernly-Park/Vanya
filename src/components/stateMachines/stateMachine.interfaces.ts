export enum StateMachineTable {
    tableName = 'stateMachines',
    arnColumn = 'arn',
    nameColumn = 'name',
    definitionColumn = 'definition',
    createDateColumn = 'creationDate',
    roleArnColumn = 'roleArn',
    statusColumn = 'status',
    typeColumn = 'type'
}

export enum StateMachineVersionTable {
    tableName = 'stateMachineVersions',
    updateDateColumn = 'updateDate',
    stateMachineArnColumn = 'arn',
    definitionColumn = 'definition',
    roleArnColumn = 'roleArn'
}

export interface IStateMachine {
    name: string,
    arn: string,
    definition: IStateMachineDefinition
    creationDate: Date
    roleArn: string
    status: StateMachineStatus,
    type: StateMachineTypes
}

export enum StateMachineStatus {
    active = 'ACTIVE',

    deleting = 'DELETING'
}

export enum StateMachineTypes {
    standard = 'STANDARD',
    express = 'EXPRESS'
}

export interface IStateMachineDefinition {
    Comment: string
    StartAt: string
    Version: string
    TimeoutSeconds: number
    States: StateMachineStates
}

export type StateMachineStates = Record<string, StateMachineStateValue>;

export interface StateMachineStateValue {
    Type: StateType,
    Comment?: string,
}

export interface PassState extends StateMachineStateValue{
    InputPath?: string
    OutputPath?: string
    Parameters: Record<string, unknown>
    ResultPath?: string
    Next?: string
    End?: boolean
    Result?: Record<string, unknown>
}

export interface TaskState extends StateMachineStateValue {
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

export interface ChoiceState extends StateMachineStateValue {
    Choice: unknown[]
    InputPath?: string
    OutputPath?: string
}

export interface WaitState extends StateMachineStateValue {
    Seconds?: number
    SecondsPath?: string
    Timestamp?: string
    TimestampPath?: string
    InputPath?: string
    OutputPath?: string
    Next?: string
    End?: boolean
}

export interface SucceedState extends StateMachineStateValue {
    InputPath?: string
    OutputPath?: string
}

export interface FailState extends StateMachineStateValue {
    Error: string
    Cause: string
}

export interface ParallelState extends StateMachineStateValue {
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

export interface MapState extends StateMachineStateValue {
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