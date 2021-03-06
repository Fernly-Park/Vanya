import * as Logger from '../../modules/logging';
import db from '../../modules/database/db'; 
import * as ActivityDAL from '@App/components/activity/activityDAL';
import { IActivity } from '@App/components/activity/activity.interfaces';
import * as ArnHelper from '../../utils/ArnHelper';
import { ensureResourceNameIsValid } from '@App/utils/validationHelper';
import { listResourcesFactory } from '../ListResourceFactory';
import { UserService } from '../user';


export const createActivity = async (userId: string, activityName: string): Promise<IActivity> => {
    Logger.logDebug(`Creating an activity named '${activityName}' by the user '${userId}'`);
    ensureResourceNameIsValid(activityName);
    Logger.logDebug(`Activity name '${activityName}' is valid`);

    await UserService.EnsureUserExists(userId);
    const activityArn = ArnHelper.generateActivityArn(userId, activityName);
    const result = await db.transaction(async (trx) => {
        const existingActivity = await ActivityDAL.selectActivityByName(trx, activityName)
        if (existingActivity) {
            return existingActivity;
        }

        Logger.logInfo(`activity '${activityName}' was given the arn '${activityArn}'`);
    
        await ActivityDAL.insertActivity(trx, activityArn, activityName);
        const toReturn = await ActivityDAL.selectActivityByArn(trx, activityArn);
        if (!toReturn) {
            throw new Error(`activity '${activityName}' should have been created.`);
        }
        
        return toReturn;
    });
    
    return result;
    
};

export const deleteActivity = async (activityArn: string): Promise<boolean> => {
    ArnHelper.ensureIsValidActivityArn(activityArn);
    const result = await ActivityDAL.deleteActivityByArn(db, activityArn);
    Logger.logInfo(`activity '${activityArn}' was deleted ? : '${result.toString()}'`);
    return result;
}

export const getActivity = async (activityArn: string): Promise<IActivity> => {
    ArnHelper.ensureIsValidActivityArn(activityArn);
    const activity = await ActivityDAL.selectActivityByArn(db, activityArn);
    Logger.logInfo(`activity '${activityArn}' retrieved: '${activity?.activityArn}'`);
    return activity;
};

export const listActivities = listResourcesFactory(ActivityDAL.countActivities, ActivityDAL.selectActivities);


