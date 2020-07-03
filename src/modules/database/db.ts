import knex from 'knex';
import config from '../../config/index';
import { logInfo, logDebug } from '../logging';
import { ActivityTable } from './activityTable.model';


const db = knex({
    client: 'pg',
    connection: config.connection_string,
    searchPath: ['public']
})

export const testDatabaseConnection = (): Promise<void> => {
    return db.raw('select 1 + 1 as result')
}

export const setupDatabase = async (): Promise<void> => {
    logDebug('Setting up the database');
    const activitiesTableExists = await db.schema.hasTable(ActivityTable.tableName);
    
    logDebug(`The activity table exists ? : ${activitiesTableExists.toString()}`)
    if (!activitiesTableExists) {
        logInfo('Creating activity table');
        await db.schema.createTable(ActivityTable.tableName, (tableBuilder: knex.CreateTableBuilder): void => {
            tableBuilder.increments();
            tableBuilder.string(ActivityTable.nameColumn).notNullable().unique().index();
            tableBuilder.timestamp(ActivityTable.createdAtColumn).notNullable().defaultTo(db.fn.now());
        });
    }
}

export default db;