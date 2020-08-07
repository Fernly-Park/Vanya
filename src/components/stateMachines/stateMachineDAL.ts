import * as Logger from '../../modules/logging';
import { DbOrTransaction } from '@App/modules/database/db';
import { StateMachineTable, IStateMachine } from './stateMachine.interfaces';
import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import * as DALFactory from '@App/components/DALFactory';

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

export const deleteStateMachineByArn = DALFactory.deleteResourceFactory(StateMachineTable.tableName, StateMachineTable.arnColumn);
export const selectStateMachineByArn = DALFactory.selectResourceFactory<IStateMachine>(StateMachineTable.tableName, StateMachineTable.arnColumn);
export const selectStateMachines = DALFactory.selectArrayOfResourcesFactory<IStateMachine>(StateMachineTable.tableName, StateMachineTable.nameColumn);
export const countStateMachines = DALFactory.countResourceFactory(StateMachineTable.tableName);