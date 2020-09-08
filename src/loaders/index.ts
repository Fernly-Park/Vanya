import express from 'express';
import loadLogging from './loadLogging';
import awsRouter from './middleware/awsRoute';
import * as logger from '../modules/logging';
import cors from 'cors';
import { AWSConstant } from '@App/utils/constants';
import {AWSRequestFilterMiddleware} from './middleware/AWSMiddleware'
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { initializeAuthentication, AWSStrategyName } from './authentication/authentication';
import { setupDatabases } from '@App/modules/database';
import { startInterpretor } from '@App/components/interpretor/interpretorService';

export default async (app: express.Express): Promise<express.Express> => {
  app.use(cookieParser())
  loadLogging(app);

  app.use(cors());
  app.use(express.json({
    type: AWSConstant.headers.CONTENT_TYPE
  }));

  initializeAuthentication(app);

  app.use(AWSRequestFilterMiddleware);

  app.use('/', 
    passport.authenticate(['jwt', AWSStrategyName], {session: false}), 
    awsRouter);
  app.use(errorHandlerMiddleware);
  await setupDatabases();

  // void startInterpretor().then();
  
  logger.logInfo('App init complete');

  return app;
}