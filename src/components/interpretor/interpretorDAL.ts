import { RunningState } from "./interpretor.interfaces";
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";

import { ExecutionStatus } from "../execution/execution.interfaces";

export const pushToStateToRunQueue = async (task: RunningState): Promise<void> => {
    await Redis.rpushAsync(Redis.systemTaskKey, JSON.stringify(task));
}

export const retrieveNextStateToExecute = async (): Promise<RunningState> => {
    const result = await Redis.blpopAsync(Redis.systemTaskKey, config.redisBlockingTimeout);
    return result ? JSON.parse(result[1]) as RunningState : null;
}


export const getExecutionStatus = async (executionArn: string): Promise<ExecutionStatus> => {
    const key = Redis.getExecutionStatusKey(executionArn);
    return await Redis.getAsync(key) as ExecutionStatus;
}

