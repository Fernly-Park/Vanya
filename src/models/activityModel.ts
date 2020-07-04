import db from '../modules/database/db';
import * as logger from '../modules/logging';
import { IActivity } from '../interfaces/iActivity.model';
import { ActivityTable } from '../modules/database/activityTable.model';

export const insertActivity = async (activityName: string): Promise<void> => {
    logger.logDebug(`registering activity '${activityName}'`);
    try {
        await db(ActivityTable.tableName).insert({[ActivityTable.nameColumn]: activityName});
        logger.logInfo(`activity '${activityName}' registered`);
    } catch (err) {
        logger.logError(`Unable to register activity '${activityName}'`);
        throw err;
    }
};

export const selectActivityByName = async(activityName: string): Promise<IActivity> => {
    logger.logDebug(`selecting activity '${activityName}'`);

    try {
        return await db<IActivity>(ActivityTable.tableName).where(ActivityTable.nameColumn, activityName).first();
    } catch (err) {
        logger.logError(`Unable to select activity '${activityName}'`);
    }
}
