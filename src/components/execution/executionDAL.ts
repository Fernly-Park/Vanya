import { DbOrTransaction } from '@App/modules/database/db';
import { ExecutionTable, ExecutionStatus, IExecution } from './execution.interfaces';
import * as DALFactory from '@App/components/DALFactory';

type InsertExecutionReq = {
    executionArn: string,
    input: string,
    name: string,
    stateMachineArn: string
}

export const insertExecution = async (db: DbOrTransaction, execution: InsertExecutionReq): Promise<IExecution> => {
    return (await db<IExecution>(ExecutionTable.tableName).insert({
        [ExecutionTable.executionArnColumn]: execution.executionArn,
        [ExecutionTable.inputColumn]: execution.input,
        [ExecutionTable.nameColumn]: execution.name,
        [ExecutionTable.stateMachineArnColumn]: execution.stateMachineArn,
        [ExecutionTable.statusColumn]: ExecutionStatus.running
    }).returning('*'))[0];    
}

type UpdateExecutionReq = {
    executionArn: string
    newStatus: ExecutionStatus
}
export const UpdateExecutionStatus = async (db: DbOrTransaction, req: UpdateExecutionReq): Promise<void> => {
    await db(ExecutionTable.tableName)
        .where(ExecutionTable.executionArnColumn, req.executionArn)
        .update({
            [ExecutionTable.statusColumn]: req.newStatus,
            [ExecutionTable.stopDateColumn]: db.fn.now()
        });
}

export const selectExecutionByArn = DALFactory.selectResourceFactory<IExecution>(ExecutionTable.tableName, ExecutionTable.executionArnColumn);