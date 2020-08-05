import * as Logger from '../../modules/logging';
import { DbOrTransaction } from '@App/modules/database/db';
import { StateMachineTable, IStateMachine } from './stateMachine.interfaces';
import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";

export const createStateMachine = async (db: DbOrTransaction, arn: string, req: CreateStateMachineInput): Promise<void> => {
    Logger.logDebug(`Insterting state machine '${arn}'`);
    await db(StateMachineTable.tableName).insert({
        [StateMachineTable.arnColumn]: arn,
        [StateMachineTable.definitionColumn]: req.definition,
        [StateMachineTable.roleArnColumn]: req.roleArn,
        [StateMachineTable.nameColumn]: req.name,
        [StateMachineTable.typeColumn]: req.type
    });
}

export const deleteStateMachineByArn = async (db: DbOrTransaction, arn: string): Promise<boolean> => {
    Logger.logDebug(`deleting state machine '${arn}'`);
    const result = await db(StateMachineTable.tableName)
        .where(StateMachineTable.arnColumn, arn)
        .delete();
    return result === 1;
}

export const selectStateMachineByArn = async (db: DbOrTransaction, arn: string): Promise<IStateMachine> => {
    return await selectStateMachineBy(db, StateMachineTable.arnColumn, arn);
}

const selectStateMachineBy = async (db: DbOrTransaction, column: StateMachineTable, ressource: string): Promise<IStateMachine> => {
    return await db<IStateMachine>(StateMachineTable.tableName).where(column, ressource).first();
};