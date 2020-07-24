import express = require('express');
import handleError from './errors/errorHandler';
import init from './loaders';


process.on('unhandledRejection', (reason: Error) => {
    throw reason;
});

process.on('uncaughtException', (error: Error) => {
    const isOperationalError = handleError(error);
    if (!isOperationalError) {
      process.exit(1);
    }
});


const app = express();

export default async (): Promise<express.Express> =>  {
  return await init(app);
}