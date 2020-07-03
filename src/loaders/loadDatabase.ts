import { testDatabaseConnection,  setupDatabase } from "../modules/database/db";
import * as logger from "../modules/logging";



export default async (): Promise<void> => {
    try {
        await testDatabaseConnection()
        logger.logInfo('Database Connection established');
    } catch (err) {
        logger.logFatal('Unable to connect to database, exiting');
        logger.logFatal(err);
        process.exit(-1);
    }

    try {
        await setupDatabase();
        logger.logInfo('Database Correctly setup')
    } catch (err) {
        logger.logFatal('Unable to setup the database, exiting');
        logger.logFatal(err);
        process.exit(-1);
    }
}
