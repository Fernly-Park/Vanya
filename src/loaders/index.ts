import express = require('express');
import loadDatabase from './loadDatabase';
import loadLogging from './loadLogging';
import awsRouter from '../components/aws/awsController';
import * as logger from '../modules/logging';
import cors from 'cors';
import { AWSConstant } from '@App/utils/constants';
import {AWSRequestFilterMiddleware} from './middleware/AWSMiddleware'
import { errorHandlerMiddleware } from './middleware/errorHandlerMiddleware';
import passport = require('passport');
import { OAuth2Strategy as GoogleStrategy } from 'passport-google-oauth';

export default async (app: express.Express): Promise<void> => {

  loadLogging(app);

  app.use(cors());
  app.use(express.json({
    type: AWSConstant.headers.CONTENT_TYPE
  }));
  
  passport.use(new GoogleStrategy({
    clientID: '92279505378-f88crcvoou9i66h17c6r3n2aqo5fs8jd.apps.googleusercontent.com',
    clientSecret: 'd8EraIS3bxvoPOfwFZq3xRXG',
    callbackURL: 'http://localhost:3000/auth/google/callback'
  }, (accesstoken, refreshToken, profile, done) => {
    console.log('hello world');
  }));
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['https://www.googleapis.com/auth/plus.login'] }));

  app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
    res.redirect('http://localhost:4200');
  });
  app.use(AWSRequestFilterMiddleware);
  
  app.use('/', awsRouter);
  app.use(errorHandlerMiddleware);
  await loadDatabase();

  logger.logInfo('App init complete');
}