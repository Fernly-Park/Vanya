import * as Logger from '../../modules/logging';
import db, { DbOrTransaction } from '../../modules/database/db'; 
import { InvalidInputError, ResourceAlreadyExistsError } from '../../errors/customErrors';
import * as ActivityDAL from '@App/components/activity/activityDAL';
import { IActivity } from '@App/components/activity/activity.interfaces';
import Joi from '@hapi/joi';
import * as ArnHelper from '../../utils/ArnHelper';
import * as UserService from '@App/components/user/userService';
import { ACTIVITY_RESOURCE_NAME } from '@App/utils/constants';

const maxActivityNameLength = 80;

export const createActivity = async (userId: string, activityName: string): Promise<IActivity> => {
    Logger.logDebug(`Creating an activity named '${activityName}' by the user '${userId}'`);
    EnsureActivityNameIsValid(activityName);
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

const EnsureActivityNameIsValid = (activityName: string): void => {
    const activityNameValidator = Joi
        .string()
        .required()
        .max(maxActivityNameLength)
        .regex(/^[^\s<>{}[\]*?"#%\\^|~`$&,;:/\u0000-\u0020\u007F-\u009F]+$/)
        .message("The activity has invalid characters");
    
    const result = activityNameValidator.validate(activityName);

    if (result.error) {
        Logger.logInfo(`Activity Name '${activityName}' is invalid`);
        throw new InvalidInputError(result.error.message);
    }
};

export const deleteActivity = async (activityArn: string): Promise<boolean> => {
    const arn = ArnHelper.parseArn(activityArn);
    if (arn.resourceType !== ACTIVITY_RESOURCE_NAME) {
        throw new InvalidInputError(`arn '${activityArn}' is not an activity arn`);
    }

    const result = await ActivityDAL.deleteActivityByArn(db, activityArn);
    Logger.logInfo(`activity '${activityArn}' was deleted ? : '${result.toString()}'`);
    return result;
}