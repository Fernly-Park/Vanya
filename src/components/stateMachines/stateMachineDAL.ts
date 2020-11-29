import * as Logger from '../../modules/logging';
import { DbOrTransaction } from '@App/modules/database/db';
import { StateMachineTable, IStateMachine, StateMachineVersionTable, StateMachineStates, StateMachineStateValue } from './stateMachine.interfaces';
import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import * as DALFactory from '@App/components/DALFactory';
import * as Redis from '@App/modules/database/redis';
import * as RedisKey from '@App/modules/database/redisKeys'

export const createStateMachine = async (db: DbOrTransaction, arn: string, req: CreateStateMachineInput, states: StateMachineStates): Promise<void> => {
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
    });
    const redisKey = RedisKey.stateMachineStateKey.get(arn);
    for(const [key, val] of Object.entries(states)) {
        await Redis.hsetAsync(redisKey, key, JSON.stringify(val));
    }
}

export const deleteStateMachine = async (db: DbOrTransaction, arn: string): Promise<boolean> => {
    await Redis.delAsync(RedisKey.stateMachineStateKey.get(arn));
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

export const retrieveState = async (req: {stateMachineArn: string, stateName: string}): Promise<StateMachineStateValue> => {
    const redisKey = RedisKey.stateMachineStateKey.get(req.stateMachineArn);
    return JSON.parse(await Redis.hgetAsync(redisKey, req.stateName)) as StateMachineStateValue;
}