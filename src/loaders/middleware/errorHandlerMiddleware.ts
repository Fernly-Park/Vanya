import * as express from "express";
import { ResourceAlreadyExistsError } from "@App/errors/customErrors";
import { HttpStatusCode } from "@App/utils/httpStatusCode";
import handleError from "@App/errors/errorHandler";
import * as logger from '@App/modules/logging';


export const errorHandlerMiddleware =  (error: Error, request: express.Request, response: express.Response, next: express.NextFunction): void => {
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
      logger.logFatal('Potentially fatar error, restarting');
      process.exit(-1);
    }
} 