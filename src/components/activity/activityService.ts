import * as Logger from '../../modules/logging';
import db, { DbOrTransaction } from '../../modules/database/db'; 
import { InvalidInputError, ResourceAlreadyExistsError } from '../../errors/customErrors';
import * as ActivityDAL from '@App/components/activity/activityDAL';
import { IActivity } from '@App/components/activity/activity.interfaces';
import Joi from '@hapi/joi';
import * as ArnHelper from '../../utils/ArnHelper';
import * as UserService from '@App/components/user/userService';
import { ensureListResourceInputAreValid, ensureResourceNameIsValid } from '@App/utils/validationHelper';
import { LIST_RESOURCE_DEFAULT_RESULT } from '@App/utils/constants';


export const createActivity = async (userId: string, activityName: string): Promise<IActivity> => {
    Logger.logDebug(`Creating an activity named '${activityName}' by the user '${userId}'`);
    ensureResourceNameIsValid(activityName);
    Logger.logDebug(`Activity name '${activityName}' is valid`);

    await UserService.EnsureUserExists(userId);
    const activityArn = ArnHelper.generateActivityArn(userId, activityName);
    const result = await db.transaction(async (trx) => {
        await EnsureActivityNameIsNotTaken(trx, activityName);

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

const EnsureActivityNameIsNotTaken = async (db: DbOrTransaction, activityName: string): Promise<void> => {
    const activityAlreadyExisting = await ActivityDAL.selectActivityByName(db, activityName);
    if (activityAlreadyExisting) {
        throw new ResourceAlreadyExistsError(`activity '${activityName}' already exists`);
    }
}

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

export const listActivities = async (req?: {maxResults?: number, nextToken?: string}): Promise<{activities: IActivity[], nextToken: string}> => {
    ensureListResourceInputAreValid(req);
    const { maxResults, nextToken } = req || {};

    const limit = maxResults ?? LIST_RESOURCE_DEFAULT_RESULT;
    const offset = nextToken ? +nextToken : 0;

    const numberOfRecord = await ActivityDAL.countActivities(db);

    if (nextToken && offset >= numberOfRecord) {
        throw new InvalidInputError(`Invalid token : '${nextToken}'`);
    }

    const result = await ActivityDAL.selectActivities(db, limit, offset);
    

    const nextTokenToReturn: string = limit + offset >= numberOfRecord ? null: (limit + offset).toString();
    
    Logger.logDebug(`sending '${result.length}' activities`);

    return {
        activities: result,
        nextToken: nextTokenToReturn
    };
};
