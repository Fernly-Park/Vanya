import db, { DbOrTransaction } from '@App/modules/database/db';
import { ExecutionTable, ExecutionStatus, IExecution, ExecutionEventTable } from './execution.interfaces';
import * as DALFactory from '@App/components/DALFactory';
import * as Redis from '@App/modules/database/redis';
import * as RedisKey from '@App/modules/database/redisKeys'
import { HistoryEvent } from 'aws-sdk/clients/stepfunctions';

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
            execution.output = execution.output ? JSON.parse(execution.output as unknown as string): execution.output
        }
        return execution;    
    }
}

const insertExecutionB = async (db: DbOrTransaction, execution: InsertExecutionReq): Promise<IExecution> => {
    const key = RedisKey.executionStatusKey.get(execution.executionArn);
    await Redis.setAsync(key, ExecutionStatus.running);
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
    const key = RedisKey.executionEventKey.get(req.executionArn);
    const stringifiedEvents = await Redis.lrangeAsync(key, 0, -1);

    const events: (HistoryEvent & {executionArn: string, event: string})[] = [];
    for(const currentStrigifiedEvent of stringifiedEvents) {
        const toPush = JSON.parse(currentStrigifiedEvent) as (HistoryEvent & {executionArn: string, event: string});
        toPush.executionArn = req.executionArn;
        toPush.event = currentStrigifiedEvent
        events.push(toPush);
    }
    await db.transaction(async (trx) => {
        await trx(ExecutionEventTable.tableName).insert(events.map((event) => ({
            [ExecutionEventTable.eventColumn]: event.event,
            [ExecutionEventTable.executionArnColumn]: event.executionArn,
            [ExecutionEventTable.idColumn]: event.id,
            [ExecutionEventTable.timestampColumn]: event.timestamp,
            [ExecutionEventTable.typeColumn]: event.type
        })));
        await trx(ExecutionTable.tableName)
        .where(ExecutionTable.executionArnColumn, req.executionArn)
        .update({
            [ExecutionTable.statusColumn]: req.newStatus,
            [ExecutionTable.stopDateColumn]: db.fn.now(),
            [ExecutionTable.outputColumn]: JSON.stringify(req.output)
        });
    });
    await Redis.setAsync(RedisKey.executionStatusKey.get(req.executionArn), req.newStatus);
    await Redis.delAsync(key);
    await Redis.delAsync(RedisKey.executionCurrentIdKey.get(req.executionArn));
    await Redis.delAsync(RedisKey.currentlyRunningStateKey.get(req.executionArn));
}


export const selectExecutionByArn = modifyExecutionInputType(
    DALFactory.selectResourceFactory<IExecution>(ExecutionTable.tableName, ExecutionTable.executionArnColumn)) as (db: DbOrTransaction, arn: string) => Promise<IExecution>;
export const selectExecutionByName = modifyExecutionInputType(
    DALFactory.selectResourceFactory<IExecution>(ExecutionTable.tableName, ExecutionTable.nameColumn)) as (db: DbOrTransaction, name: string) => Promise<IExecution>;
export const countExecutions = DALFactory.countResourceFactory(ExecutionTable.tableName);


export const addExecutionEvent = async (req: {executionArn: string, event: Partial<HistoryEvent>}): Promise<number> => {
    const key = RedisKey.executionEventKey.get(req.executionArn);
    req.event.id = (await Redis.incrAsync(RedisKey.executionCurrentIdKey.get(req.executionArn)));
    await Redis.rpushAsync(key, JSON.stringify(req.event));
    return req.event.id
}

const selectListExecutionEvent = DALFactory.selectArrayOfResourcesFactory<HistoryEvent & {event: string}>(ExecutionEventTable.tableName, ExecutionEventTable.idColumn);


export const getExecutionEvent = async (req: {executionArn: string, limit: number, offset: number, asc?: boolean}): Promise<HistoryEvent[]> => {
    const toReturn: HistoryEvent[] = [];
    return await db.transaction(async (trx) => {
        const execution = await selectExecutionByArn(trx, req.executionArn);
        if (execution.status === ExecutionStatus.running) {
            const key = RedisKey.executionEventKey.get(req.executionArn);
            const stringifiedEvents = await Redis.lrangeAsync(key, req.offset, req.limit);
            for(const currentStrigifiedEvent of stringifiedEvents) {
                toReturn.push(JSON.parse(currentStrigifiedEvent));
            }
            return toReturn;
        } else {
            const events = await selectListExecutionEvent(trx, req.limit, req.offset, req.asc);
            for(const currentEvent of events) {
                toReturn.push(JSON.parse(currentEvent.event))
            }
            return toReturn;
        }
    }); 
}

