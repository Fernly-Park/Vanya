import * as logger from '../../modules/logging';
import { IActivity } from './activity.interfaces';
import { ActivityTable } from './activity.interfaces';
import { DbOrTransaction } from '@App/modules/database/db';


export const insertActivity = async (db: DbOrTransaction, activityArn: string, activityName: string): Promise<void> => {
    logger.logDebug(`registering activity '${activityArn}'`);
    await db(ActivityTable.tableName).insert({
        [ActivityTable.arnColumn]: activityArn,
        [ActivityTable.nameColumn]: activityName
    });
    logger.logInfo(`activity '${activityArn}' registered`);

};

export const deleteActivityByArn = async (db: DbOrTransaction, activityArn: string): Promise<boolean> => {
    logger.logDebug(`deleting activity '${activityArn}'`);
    const result = await db(ActivityTable.tableName)
    .where(ActivityTable.arnColumn, activityArn)
    .delete();

    return result === 1;

}

export const selectActivityByName = 
async(db: DbOrTransaction, activityName: string): Promise<IActivity> => {
    return await selectActivityBy(db, ActivityTable.nameColumn, activityName);
};

export const selectActivityByArn = async(db: DbOrTransaction, activityArn: string): Promise<IActivity> => {
    return await selectActivityBy(db, ActivityTable.arnColumn, activityArn);
};

const selectActivityBy = async (db: DbOrTransaction, column: ActivityTable, ressource: string): Promise<IActivity> => {
    return await db<IActivity>(ActivityTable.tableName).where(column, ressource).first();
};

export const selectActivities = async (db: DbOrTransaction, limit:number, offset: number): Promise<IActivity[]> => {
    return await db<IActivity>(ActivityTable.tableName).orderBy(ActivityTable.nameColumn).limit(limit).offset(offset);
};

export const countActivities = async (db: DbOrTransaction): Promise<number> => {
    const result = await db<IActivity>(ActivityTable.tableName).count();
    return +result[0].count;
};

