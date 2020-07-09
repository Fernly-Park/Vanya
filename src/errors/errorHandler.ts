import * as logger from '../modules/logging';
import {BaseError} from '../errors/customErrors';

const handleError = (err: any): boolean => {
    logger.logError(err);
    return isOperationalError(err);
}

const isOperationalError = (error: Error): boolean => {
    if (error instanceof BaseError) {
        return error.isOperational;
    } 
    return false;
}
export default handleError;