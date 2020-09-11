import * as RelationalDb from './db';
import * as Logger from '@App/modules/logging';
import * as Redis from './redis';

export const setupDatabases = async (): Promise<void> => {
    try {
        Redis.startRedis();
        Redis.onConnectionSuccess(() => {
            Logger.logInfo('successfully connected to redis');
        });
        Redis.onConnectionError(() => {
            throw new Error('Error with redis connection');
        })
        await RelationalDb.testDatabaseConnection();
        Logger.logInfo('Database Connection established');
    } catch (err) {
        Logger.logFatal('Unable to connect to database, exiting');
        Logger.logFatal(err);
        process.exit(-1);
    }

    try {

        await RelationalDb.setupDatabase();
        Logger.logInfo('Database Correctly setup')
    } catch (err) {
        Logger.logFatal('Unable to setup the database, exiting');
        Logger.logFatal(err);
        process.exit(-1);
    }
}
