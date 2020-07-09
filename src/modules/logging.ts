
import pino from 'pino';
import { asyncLocalStorage } from '../utils/contextualStorage';
import config from '../config/index';
import { AWSConstant, REQUEST_ID_HEADER } from '@App/utils/constants';

export const logger = pino({
    level: config.log.level || 'info',
});
    
export const logInfo = (message: string): void =>  {
    logger.info(retrieveRequestId(), message);
};

export const logError = (message: string): void => {
    logger.error(retrieveRequestId(), message);
};

export const logFatal = (message: string): void => {
    logger.fatal(retrieveRequestId(), message);
}

export const logDebug = (message: string): void => {
    logger.debug(retrieveRequestId(), message);
}

const retrieveRequestId = (): {[REQUEST_ID_HEADER]: string} => {
    const requestId = asyncLocalStorage.getStore() as string;
    return {[REQUEST_ID_HEADER]: requestId}
};