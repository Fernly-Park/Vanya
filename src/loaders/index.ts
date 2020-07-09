import express = require('express');
import loadDatabase from './loadDatabase';
import loadLogging from './loadLogging';
import awsRouter from '../components/aws/awsController';
import handleError from '../errors/errorHandler';
import * as logger from '../modules/logging';
import { HttpStatusCode } from '@App/utils/httpStatusCode';
import { ResourceAlreadyExistsError } from '@App/errors/customErrors';
import cors from 'cors';
import { AWSConstant } from '@App/utils/constants';
import {AWSRequestFilterMiddleware} from './middleware/AWSMiddleware'
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware';

export default async (app: express.Express): Promise<void> => {

  loadLogging(app);

  app.use(cors());
  app.use(express.json({
    type: AWSConstant.headers.CONTENT_TYPE
  }));
  
  app.use(AWSRequestFilterMiddleware);
  app.use('/', awsRouter);
  app.use(errorHandlerMiddleware);
  await loadDatabase();

  logger.logInfo('App init complete');
}