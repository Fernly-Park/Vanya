import knex from 'knex';
import config from '../../config/index';
import * as Logger from '../logging';
import { ActivityTable } from '../../components/activity/activity.interfaces';
import { UserTable } from '../../components/user/user.interfaces';
import Knex from 'knex';


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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DbOrTransaction = Knex.Transaction | Knex<any, unknown[]>;

const setupActivityTable = async(): Promise<void> => {
    Logger.logDebug('Creating activity table');
    const activitiesTableExists = await db.schema.hasTable(ActivityTable.tableName);
    
    Logger.logDebug(`The activity table exists ? : ${activitiesTableExists.toString()}`)
    if (!activitiesTableExists) {
        await db.schema.createTable(ActivityTable.tableName, (tableBuilder: knex.CreateTableBuilder): void => {
            tableBuilder.increments();
            tableBuilder.string(ActivityTable.arnColumn).notNullable().unique().index();
            tableBuilder.string(ActivityTable.nameColumn).notNullable().unique().index();
            tableBuilder.timestamp(ActivityTable.creationDateColumn).notNullable().defaultTo(db.fn.now());
        });
    }
};

const setupUserTable = async(): Promise<void> => {
    Logger.logDebug('Creating users table');

    const usersTableExists = await db.schema.hasTable(UserTable.tableName);
    Logger.logDebug(`The users table exists ? : ${usersTableExists.toString()}`)
    if (!usersTableExists) {
        await db.schema.createTable(UserTable.tableName, (tableBuilder): void => {
            tableBuilder.string(UserTable.idColumn).primary().index();
            tableBuilder.string(UserTable.emailColumn).notNullable().unique().index();
            tableBuilder.string(UserTable.subColumn).nullable().unique()
            tableBuilder.string(UserTable.secretColumn).nullable();
        });
    }
};

export default db;