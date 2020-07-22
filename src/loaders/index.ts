import express from 'express';
import loadDatabase from './loadDatabase';
import loadLogging from './loadLogging';
import awsRouter from '../components/aws/awsController';
import * as logger from '../modules/logging';
import cors from 'cors';
import { AWSConstant } from '@App/utils/constants';
import {AWSRequestFilterMiddleware} from './middleware/AWSMiddleware'
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware';
import passport from 'passport';
import cookieParser from 'cookie-parser';
import { initializeAuthentication } from './authentication/authentication';

export default async (app: express.Express): Promise<void> => {
  app.use(cookieParser())
  loadLogging(app);

  app.use(cors());
  app.use(express.json({
    type: AWSConstant.headers.CONTENT_TYPE
  }));

  initializeAuthentication(app);

  app.use(AWSRequestFilterMiddleware);
  
  app.use('/', passport.authenticate('jwt', {session: false}), awsRouter);
  app.use(errorHandlerMiddleware);
  await loadDatabase();

  logger.logInfo('App init complete');
}