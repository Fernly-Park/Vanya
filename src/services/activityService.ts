import * as logger from '../modules/logging';
import { InvalidNameError, ResourceAlreadyExistsError } from '../errors/customErrors';
import { selectActivityByName, insertActivity } from '@App/models/activityModel';
import { isAString } from '@App/utils/stringUtils';
import { IActivity } from '@App/interfaces/iActivity.model';

const maxActivityNameLength = 80;

export const createActivity = async (activityName: string): Promise<IActivity> => {
    logger.logInfo(`Creating an activity named '${activityName}'`)

    if (!isActivityNameValid(activityName)) {
        throw new InvalidNameError(`activity name '${activityName}' is invalid`);
    }

    const activityAlreadyExisting = await selectActivityByName(activityName);
    if (activityAlreadyExisting) {
        throw new ResourceAlreadyExistsError(`activity '${activityName}' already exists`);
    }

    await insertActivity(activityName);
    const toReturn = await selectActivityByName(activityName);
    if (!toReturn) {
        throw new Error(`activity '${activityName}' should have been created.`)
    }
    
    return toReturn;
};

const isActivityNameValid = (activityName: string): boolean => {
    if (!isAString(activityName) || activityName.length > maxActivityNameLength) {
        return false;
    }

    const validActivityNameRegex = /^[^\s<>{}[\]*?"#%\\^|~`$&,;:/\u0000-\u0020\u007F-\u009F]+$/;
    return validActivityNameRegex.test(activityName);
};