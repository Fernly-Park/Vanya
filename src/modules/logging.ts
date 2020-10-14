
import pino from 'pino';
import { asyncLocalStorage } from '../utils/contextualStorage';
import config from '../config/index';
import { REQUEST_ID_HEADER } from '@App/utils/constants';

export const logger = pino({
    level: config.log.level || 'info'
}, pino.destination());
    
export const logInfo = (message: string): void =>  {
    logger.info(retrieveRequestId(), message);
};

export const logWarning = (message: string): void => {
    logger.warn(retrieveRequestId(), message);
}
export const logError = (message: string | Error): void => {
    if (message instanceof Error) {
        const requestId = retrieveRequestId();
        logger.error(message, `${REQUEST_ID_HEADER} : ${requestId[REQUEST_ID_HEADER]}`);
    } else {
        logger.error(retrieveRequestId(), message);
    }
};

export const logFatal = (message: string | Error): void => {
    if (message instanceof Error) {
        const requestId = retrieveRequestId();
        logger.fatal(message, `${REQUEST_ID_HEADER} : ${requestId[REQUEST_ID_HEADER]}`);
    } else {
        logger.fatal(retrieveRequestId(), message);
    }
}

export const logDebug = (message: string): void => {
    logger.debug(retrieveRequestId(), message);
}

const retrieveRequestId = (): {[REQUEST_ID_HEADER]: string} => {
    const requestId = asyncLocalStorage.getStore() as string;
    return {[REQUEST_ID_HEADER]: requestId}
};