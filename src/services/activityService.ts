import { logInfo, logError } from '../modules/logging';
import { InvalidNameError } from '../errors/customErrors';

const maxActivityNameLength = 80;

export const createActivity = async (activityName: string): Promise<void> => {
    logInfo(`Creating an activity named '${activityName}'`)
    if (!isActivityNameValid(activityName)) {
        logError(`Activity name '${activityName}' is invalid. Aborting creation`)
        throw new InvalidNameError(`activity name '${activityName}' is invalid`);
    }
};

const isActivityNameValid = (activityName: string): boolean => {
    if (activityName.length > maxActivityNameLength) {
        return false;
    }

    const validActivityNameRegex = /^[^\s<>{}[\]*?"#%\\^|~`$&,;:/\u0000-\u0020\u007F-\u009F]+$/;
    return validActivityNameRegex.test(activityName);
};