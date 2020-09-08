import { DbOrTransaction } from '@App/modules/database/db';
import { ExecutionTable, ExecutionStatus, IExecution, ContextObject, ExecutionInput } from './execution.interfaces';
import * as DALFactory from '@App/components/DALFactory';
import * as Redis from '@App/modules/database/redis';

type InsertExecutionReq = {
    executionArn: string,
    input: string,
    name: string,
    stateMachineArn: string
}

const modifyExecutionInputType = (functionToEnhance: (...d: any) => Promise<IExecution>) => {
    return async (...args: any[]): Promise<IExecution> => {
        const execution = await functionToEnhance(...args)
        if (execution) {
            execution.input = JSON.parse(execution.input as unknown as string);
        }
        return execution;    
    }
}

const insertExecutionB = async (db: DbOrTransaction, execution: InsertExecutionReq): Promise<IExecution> => {
    return (await db(ExecutionTable.tableName).insert({
        [ExecutionTable.executionArnColumn]: execution.executionArn,
        [ExecutionTable.inputColumn]: execution.input,
        [ExecutionTable.nameColumn]: execution.name,
        [ExecutionTable.stateMachineArnColumn]: execution.stateMachineArn,
        [ExecutionTable.statusColumn]: ExecutionStatus.running
    }).returning('*'))[0] as Promise<IExecution>;
}

export const insertExecution = modifyExecutionInputType(insertExecutionB) as (db: DbOrTransaction, execution: InsertExecutionReq) => Promise<IExecution>;

type UpdateExecutionReq = {
    executionArn: string
    newStatus: ExecutionStatus,
    output?: unknown
}

export const updateExecutionStatus = async (db: DbOrTransaction, req: UpdateExecutionReq): Promise<void> => {
    await db(ExecutionTable.tableName)
        .where(ExecutionTable.executionArnColumn, req.executionArn)
        .update({
            [ExecutionTable.statusColumn]: req.newStatus,
            [ExecutionTable.stopDateColumn]: db.fn.now(),
            [ExecutionTable.outputColumn]: typeof req.output === 'string' ? req.output : JSON.stringify(req.output)
        });
}


export const selectExecutionByArn = modifyExecutionInputType(
    DALFactory.selectResourceFactory<IExecution>(ExecutionTable.tableName, ExecutionTable.executionArnColumn)) as (db: DbOrTransaction, arn: string) => Promise<IExecution>;
export const selectExecutionByName = modifyExecutionInputType(
    DALFactory.selectResourceFactory<IExecution>(ExecutionTable.tableName, ExecutionTable.nameColumn)) as (db: DbOrTransaction, name: string) => Promise<IExecution>;
export const countExecutions = DALFactory.countResourceFactory(ExecutionTable.tableName);

export const setContextObject = async (executionArn: string, contextObject: ContextObject): Promise<void> => {
    const key = Redis.getContextObjectKey(executionArn);
    await Redis.jsonsetAsync(key, '.', JSON.stringify(contextObject));
}

export const updateContextObject = async (req: {executionArn: string, path: string, update: Record<string, unknown>}): Promise<void> => {
    const key = Redis.getContextObjectKey(req.executionArn);
    await Redis.jsonsetAsync(key, req.path, JSON.stringify(req.update));
} 

export const getContextObject = async (executionArn: string): Promise<ContextObject> => {
    const key = Redis.getContextObjectKey(executionArn);
    const contextObject = await Redis.jsongetAsync(key);
    return JSON.parse(contextObject) as ContextObject;
}

export const deleteContextObject = async (executionArn: string): Promise<void> => {
    const key = Redis.getContextObjectKey(executionArn);
    await Redis.jsondelAsync(key);
}
