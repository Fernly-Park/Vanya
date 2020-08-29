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

export interface IExecution {
    executionArn: string,
    input: unknown,
    name: string,
    output: unknown,
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