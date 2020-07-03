import express = require('express');
import loadDatabase from './loadDatabase';
import loadLogging from './loadLogging';
import activitiesRouter from '../controllers/activityController';
import handleError from '../errors/errorHandler';
import * as logger from '../modules/logging';

export default async (app: express.Express): Promise<void> => {

    loadLogging(app);
    app.use(express.json());
    app.use('/api/activities', activitiesRouter);

    // Error handling middleware, we delegate the handling to the centralized error handler
    app.use((error: Error, request: express.Request, response: express.Response, next: express.NextFunction) => {
    const isOperationalError = handleError(error);
    if (!isOperationalError) {
        next(error);
    }
  });
  await loadDatabase();

  logger.logInfo('App init complete');
}