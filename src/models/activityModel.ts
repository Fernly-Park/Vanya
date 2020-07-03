import db from '../modules/database/db';
import * as logger from '../modules/logging';
import { IActivity } from '../interfaces/iActivity.model';
import { ActivityTable } from '../modules/database/activityTable.model';

export const registerActivity = async (activity: IActivity): Promise<void> => {
    if (!activity || !activity.name || typeof activity.name !== 'string' || activity.name)
    logger.logDebug(`registering activity '${activity.name}'`);
    try {
        await db('activities').insert({[ActivityTable.nameColumn]: activity.name});
        logger.logInfo(`activity '${activity.name}' registered`);
    } catch (err) {
        logger.logError(`Unable to register activity '${activity.name}'`);
        throw err;
    }
};
