import db from '../../modules/database/db';
import * as logger from '../../modules/logging';
import { IActivity } from './activity.interfaces';
import { ActivityTable } from '../../modules/database/activityTable.model';

export const insertActivity = async (activityArn: string, activityName: string): Promise<void> => {
    logger.logDebug(`registering activity '${activityArn}'`);
    try {
        await db(ActivityTable.tableName).insert({
            [ActivityTable.arnColumn]: activityArn,
            [ActivityTable.nameColumn]: activityName
        });
        
        logger.logInfo(`activity '${activityArn}' registered`);
    } catch (err) {
        logger.logError(`Unable to register activity '${activityArn}'`);
        throw err;
    }
    
};

export const deleteActivityByArn = async (activityArn: string): Promise<boolean> => {
    logger.logDebug(`deleting activity '${activityArn}'`);
    try {
        const result = await db(ActivityTable.tableName)
        .where(ActivityTable.arnColumn, activityArn)
        .delete();

        return result === 1;
    } catch (err) {
        logger.logError(`Unable to delete activity '${activityArn}'`);
    }
}

export const selectActivityByName = async(activityName: string): Promise<IActivity> => {
    return await selectActivityBy(ActivityTable.nameColumn, activityName);
};

export const selectActivityByArn = async(activityArn: string): Promise<IActivity> => {
    return await selectActivityBy(ActivityTable.arnColumn, activityArn);
};

const selectActivityBy = async (column: ActivityTable, ressource: string): Promise<IActivity> => {
    try {
        return await db<IActivity>(ActivityTable.tableName).where(column, ressource).first();
    } catch (err) {
        logger.logError(`Unable to select activity with column '${column}' equal to '${ressource}'`);
    }
};

