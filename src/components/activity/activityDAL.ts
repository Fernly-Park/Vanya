import * as Logger from '../../modules/logging';
import * as DALFactory from '@App/components/DALFactory';
import { IActivity } from './activity.interfaces';
import { ActivityTable } from './activity.interfaces';
import { DbOrTransaction } from '@App/modules/database/db';


export const insertActivity = async (db: DbOrTransaction, activityArn: string, activityName: string): Promise<void> => {
    Logger.logDebug(`registering activity '${activityArn}'`);
    await db(ActivityTable.tableName).insert({
        [ActivityTable.arnColumn]: activityArn,
        [ActivityTable.nameColumn]: activityName
    });
    Logger.logInfo(`activity '${activityArn}' registered`);

};

export const deleteActivityByArn = DALFactory.deleteResourceFactory(ActivityTable.tableName, ActivityTable.arnColumn);
export const selectActivityByName = DALFactory.selectResourceFactory<IActivity>(ActivityTable.tableName, ActivityTable.nameColumn);
export const selectActivityByArn = DALFactory.selectResourceFactory<IActivity>(ActivityTable.tableName, ActivityTable.arnColumn);
export const selectActivities = DALFactory.selectArrayOfResourcesFactory<IActivity>(ActivityTable.tableName, ActivityTable.nameColumn);
export const countActivities = DALFactory.countResourceFactory(ActivityTable.tableName);

