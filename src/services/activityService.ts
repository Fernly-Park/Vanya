import * as logger from '../modules/logging';
import { InvalidNameError, ResourceAlreadyExistsError } from '../errors/customErrors';
import * as ActivityModel from '@App/models/activityModel';
import { IActivity } from '@App/interfaces/iActivity.model';
import Joi from '@hapi/joi';
import * as ArnHelper from './ArnHelper';

const maxActivityNameLength = 80;

export const createActivity = async (activityName: string): Promise<IActivity> => {
    logger.logInfo(`Creating an activity named '${activityName}'`);
    EnsureActivityNameIsValid(activityName);
    logger.logDebug(`Activity name '${activityName}' is valid`);

    await EnsureActivityNameIsNotTaken(activityName);

    const activityArn = ArnHelper.generateArn(activityName);
    logger.logInfo(`activity '${activityName}' was given the arn '${activityArn}'`);

    await ActivityModel.insertActivity(activityArn, activityName);
    const toReturn = await ActivityModel.selectActivityByArn(activityArn);
    if (!toReturn) {
        throw new Error(`activity '${activityName}' should have been created.`);
    }
    
    return toReturn;
};

const EnsureActivityNameIsNotTaken = async (activityName: string): Promise<void> => {
    const activityAlreadyExisting = await ActivityModel.selectActivityByName(activityName);
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
        logger.logInfo(`Activity Name '${activityName}' is invalid`);
        throw new InvalidNameError(result.error.message);
    }
};

export const deleteActivity = async (activityArn: string): Promise<void> => {

}