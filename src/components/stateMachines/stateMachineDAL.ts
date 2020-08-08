import * as Logger from '../../modules/logging';
import { DbOrTransaction } from '@App/modules/database/db';
import { StateMachineTable, IStateMachine, StateMachineVersionTable } from './stateMachine.interfaces';
import { CreateStateMachineInput, UpdateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import * as DALFactory from '@App/components/DALFactory';

export const createStateMachine = async (db: DbOrTransaction, arn: string, req: CreateStateMachineInput): Promise<void> => {
    Logger.logDebug(`Insterting state machine '${arn}'`);
    await db.transaction(async trx => {
        await trx(StateMachineTable.tableName).insert({
            [StateMachineTable.arnColumn]: arn,
            [StateMachineTable.definitionColumn]: req.definition,
            [StateMachineTable.roleArnColumn]: req.roleArn,
            [StateMachineTable.nameColumn]: req.name,
            [StateMachineTable.typeColumn]: req.type
        });
    
        await trx(StateMachineVersionTable.tableName).insert({
            [StateMachineVersionTable.definitionColumn]: req.definition,
            [StateMachineVersionTable.roleArnColumn]: req.roleArn,
            [StateMachineVersionTable.stateMachineArnColumn]: arn,
        });
    })
    
}

export const deleteStateMachine = async (db: DbOrTransaction, arn: string): Promise<boolean> => {
    return await db.transaction(async trx => {
        await DALFactory.deleteResourceFactory(StateMachineVersionTable.tableName, StateMachineVersionTable.stateMachineArnColumn)(trx, arn);
        return await DALFactory.deleteResourceFactory(StateMachineTable.tableName, StateMachineTable.arnColumn)(trx, arn);
    });
}

export const selectStateMachineByArn = DALFactory.selectResourceFactory<IStateMachine>(StateMachineTable.tableName, StateMachineTable.arnColumn);
export const selectStateMachines = DALFactory.selectArrayOfResourcesFactory<IStateMachine>(StateMachineTable.tableName, StateMachineTable.nameColumn);
export const countStateMachines = DALFactory.countResourceFactory(StateMachineTable.tableName);

type UpdateStateMachineDALInput = {
    stateMachineArn: string,
    definition?: string,
    roleArn?: string,
  };
  
export const updateStateMachine = async (db: DbOrTransaction, req: UpdateStateMachineDALInput): Promise<Date> => {
    return await db.transaction(async trx => {
        await trx(StateMachineTable.tableName)
        .where(StateMachineTable.arnColumn, req.stateMachineArn)
        .update({
            [StateMachineTable.definitionColumn]: req.definition,
            [StateMachineTable.roleArnColumn]: req.roleArn
        });    
        return await trx(StateMachineVersionTable.tableName)
            .insert({
                [StateMachineVersionTable.definitionColumn]: req.definition,
                [StateMachineVersionTable.roleArnColumn]: req.roleArn,
                [StateMachineVersionTable.stateMachineArnColumn]: req.stateMachineArn
            })
            .returning(StateMachineVersionTable.updateDateColumn);
    });
} 