import express from 'express';
import pino from 'pino-http';
import { v4 as uuid } from 'uuid'

import { asyncLocalStorage } from '../utils/contextualStorage';
import { REQUEST_ID_HEADER } from '../utils/constants';
import config from '../config';


export default (app: express.Express): void => {
    app.use((req, res, next) => {
        const reqId: string = req.get(REQUEST_ID_HEADER) || uuid();
        res.set(REQUEST_ID_HEADER, reqId);
    
        asyncLocalStorage.run(reqId, () => {
            next();
        });
    })
    
    app.use(pino({
        level: config.log.level || 'info',
        
        genReqId: (req) => req.headers[REQUEST_ID_HEADER]
    }));
    
}