import express = require('express');
import loadDatabase from './loadDatabase';
import loadLogging from './loadLogging';
import activitiesRouter from '../controllers/activityController';
import handleError from '../errors/errorHandler';
import * as logger from '../modules/logging';
import { HttpStatusCode } from '@App/utils/httpStatusCode';
import { ResourceAlreadyExistsError } from '@App/errors/customErrors';

export default async (app: express.Express): Promise<void> => {

    loadLogging(app);
    app.use(express.json());
    app.use('/api/activities', activitiesRouter);

    app.use((error: Error, request: express.Request, response: express.Response, next: express.NextFunction) => {
 
    const isOperationalError = handleError(error);
    if (isOperationalError) {
      if (error instanceof ResourceAlreadyExistsError) {
        response.status(HttpStatusCode.CONFLICT);
      } else {
        response.status(HttpStatusCode.BAD_REQUEST);
      }
      response.send({ message: error.message});
      next(error);
    } else {
      logger.logError('Potentially fatar error, restarting');
      process.exit(-1);
    }
  });
  await loadDatabase();

  logger.logInfo('App init complete');
}