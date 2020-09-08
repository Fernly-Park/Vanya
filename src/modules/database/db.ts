import knex from 'knex';
import config from '../../config/index';
import * as Logger from '../logging';
import { ActivityTable } from '../../components/activity/activity.interfaces';
import { UserTable } from '../../components/user/user.interfaces';
import Knex from 'knex';

import { StateMachineTable, StateMachineStatus, StateMachineTypes, StateMachineVersionTable } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionTable, ExecutionStatus } from '@App/components/execution/execution.interfaces';


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
    await setupStateMachineVersionsTable();
    await setupExecutionTable();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOrTransaction = Knex.Transaction | Knex<any, unknown[]>;

const setupActivityTable = async(): Promise<void> => {
    await createTableIfNotExists(ActivityTable.tableName, (tableBuilder): void => {
        tableBuilder.increments();
        tableBuilder.text(ActivityTable.arnColumn).notNullable().unique().index();
        tableBuilder.text(ActivityTable.nameColumn).notNullable().unique().index();
        tableBuilder.timestamp(ActivityTable.creationDateColumn).notNullable().defaultTo(db.fn.now());
    });
};

const setupUserTable = async(): Promise<void> => {
    await createTableIfNotExists(UserTable.tableName, (tableBuilder): void => {
        tableBuilder.text(UserTable.idColumn).primary().index();
        tableBuilder.text(UserTable.emailColumn).notNullable().unique().index();
        tableBuilder.text(UserTable.subColumn).nullable().unique()
        tableBuilder.text(UserTable.secretColumn).nullable();
    });
};

const setupStateMachineTable = async(): Promise<void> => {
    await createTableIfNotExists(StateMachineTable.tableName, (tableBuilder) => {
        tableBuilder.text(StateMachineTable.arnColumn).primary().index();
        tableBuilder.jsonb(StateMachineTable.definitionColumn).notNullable();
        tableBuilder.timestamp(StateMachineTable.createDateColumn).notNullable().defaultTo(db.fn.now());
        tableBuilder.text(StateMachineTable.roleArnColumn).notNullable();
        tableBuilder.text(StateMachineTable.statusColumn).notNullable().defaultTo(StateMachineStatus.active);
        tableBuilder.text(StateMachineTable.typeColumn).notNullable().defaultTo(StateMachineTypes.standard);
        tableBuilder.text(StateMachineTable.nameColumn).notNullable();
    });
}

const setupStateMachineVersionsTable = async(): Promise<void> => {
    await createTableIfNotExists(StateMachineVersionTable.tableName, tableBuilder => {
        tableBuilder.text(StateMachineVersionTable.stateMachineArnColumn).notNullable().references(StateMachineTable.arnColumn).inTable(StateMachineTable.tableName);
        tableBuilder.timestamp(StateMachineVersionTable.updateDateColumn).notNullable().defaultTo(db.fn.now());
        tableBuilder.jsonb(StateMachineVersionTable.definitionColumn).notNullable();
        tableBuilder.text(StateMachineVersionTable.roleArnColumn).notNullable();
        tableBuilder.primary([StateMachineVersionTable.stateMachineArnColumn, StateMachineVersionTable.updateDateColumn]);
    });
}

const setupExecutionTable = async (): Promise<void> => {
    await createTableIfNotExists(ExecutionTable.tableName, tableBuilder => {
        tableBuilder.text(ExecutionTable.executionArnColumn).primary().index();
        tableBuilder.text(ExecutionTable.inputColumn).nullable();
        tableBuilder.text(ExecutionTable.nameColumn).notNullable();
        tableBuilder.text(ExecutionTable.outputColumn).nullable();
        tableBuilder.timestamp(ExecutionTable.startDateColumn).notNullable().defaultTo(db.fn.now());
        tableBuilder.text(ExecutionTable.stateMachineArnColumn).notNullable().references(StateMachineTable.arnColumn).inTable(StateMachineTable.tableName);
        tableBuilder.text(ExecutionTable.statusColumn).notNullable().defaultTo(ExecutionStatus.running);
        tableBuilder.timestamp(ExecutionTable.stopDateColumn).nullable();
    });
}

const createTableIfNotExists = async (tableName: string, createTableCallback: (tableBuilder: Knex.CreateTableBuilder) => void): Promise<void> => {
    Logger.logDebug(`Creating '${tableName}' table`);
    const tableExists = await db.schema.hasTable(tableName);
    Logger.logDebug(`The '${tableName}' table exists ? : ${tableExists.toString()}`);

    if (!tableExists) {
        Logger.logDebug(`Creating '${tableName}' table`);
        await db.schema.createTable(tableName, createTableCallback);
    }
}

export default db;