/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import knex from 'knex';
import config from '../../config/index';
import * as Logger from '../logging';
import { ActivityTable } from '../../components/activity/activity.interfaces';
import { UserTable } from '../../components/user/user.interfaces';
import Knex from 'knex';

import { StateMachineTable } from '@App/components/stateMachines/stateMachine.interfaces';


const db = knex({
    client: 'pg',
    connection: config.connection_string,
    searchPath: ['public']
})

export const testDatabaseConnection = (): Promise<void> => {
    return db.raw('select 1 + 1 as result')
}

export const setupDatabase = async (): Promise<void> => {
    Logger.logDebug('Setting up the database');
    await setupActivityTable();
    await setupUserTable();
    await setupStateMachineTable();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOrTransaction = Knex.Transaction | Knex<any, unknown[]>;

const setupActivityTable = async(): Promise<void> => {
    await createTableIfNotExists(ActivityTable.tableName, (tableBuilder: any): void => {
        tableBuilder.increments();
        tableBuilder.string(ActivityTable.arnColumn).notNullable().unique().index();
        tableBuilder.string(ActivityTable.nameColumn).notNullable().unique().index();
        tableBuilder.timestamp(ActivityTable.creationDateColumn).notNullable().defaultTo(db.fn.now());
    });
};

const setupUserTable = async(): Promise<void> => {
    await createTableIfNotExists(UserTable.tableName, (tableBuilder: Knex.CreateTableBuilder): void => {
        tableBuilder.string(UserTable.idColumn).primary().index();
        tableBuilder.string(UserTable.emailColumn).notNullable().unique().index();
        tableBuilder.string(UserTable.subColumn).nullable().unique()
        tableBuilder.string(UserTable.secretColumn).nullable();
    });
};

const setupStateMachineTable = async(): Promise<void> => {
    // return null;
    await createTableIfNotExists(StateMachineTable.tableName, (tableBuilder) => {
        tableBuilder.string(StateMachineTable.arnColumn).primary().index();
        tableBuilder.jsonb(StateMachineTable.definitionColumn).notNullable();
        tableBuilder.timestamp(StateMachineTable.createDateColumn).notNullable().defaultTo(db.fn.now());
    });
}

const createTableIfNotExists = async (tableName: string, createTableCallback: (tableBuilder: any) => void): Promise<void> => {
    Logger.logDebug(`Creating '${tableName}' table`);
    const tableExists = await db.schema.hasTable(tableName);
    Logger.logDebug(`The '${tableName}' table exists ? : ${tableExists.toString()}`);

    if (tableExists) {
        await db.schema.createTable(tableName, createTableCallback);
    }
}

export default db;