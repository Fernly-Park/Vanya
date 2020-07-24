/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import express from 'express';
import jwt from 'jsonwebtoken';
import { IUser } from '@App/components/user/user.interfaces';
import passport from 'passport';
import {Strategy as CustomStrategy} from 'passport-custom';
import {Strategy as JwtStrategy, StrategyOptions, VerifyCallbackWithRequest} from 'passport-jwt';
import { OAuth2Strategy as GoogleStrategy, VerifyFunction } from 'passport-google-oauth';
import * as UserService from '@App/components/user/userService';
import config from '../../config/index'
import { checkAWSSignature } from './AWSAuthentication';

const jwtKeyInCookie = 'jwt';
export const AWSStrategyName = 'AWS-local';

export const initializeAuthentication = (app: express.Express): void => {
    app.use(passport.initialize());

    initializeJWTStrategy();
    initializeAWSAuthentication();
    initializeGoogleAuthentication(app);
}

const initializeJWTStrategy = (): void => {
    const option: StrategyOptions = {
        secretOrKey: config.authentication.jwtSecret,
        jwtFromRequest: req => req.cookies[jwtKeyInCookie],
        passReqToCallback: true
    };

    const verifyCallback: VerifyCallbackWithRequest = (req, payload, done) => {
        const clientID = payload.sub;
        req.user = clientID;
        done(null, clientID);
      }
    passport.use(new JwtStrategy(option, verifyCallback));
}

const initializeAWSAuthentication = (): void => {
  passport.use(AWSStrategyName, new CustomStrategy((req, done) => {
    checkAWSSignature(req.headers as {[headerName: string]: string})
      .then(user => done(null, user))
      .catch(err => done(err))
  }));
};

const initializeGoogleAuthentication = (app: express.Express): void => {
    const googleConfig = config.authentication.google;
    passport.use(new GoogleStrategy({
        clientID: googleConfig.clientID,
        clientSecret: googleConfig.clientSecret,
        callbackURL: googleConfig.callbackURL,
        
      }, function (accesstoken, refreshToken, profile, done) {
        const email = profile.emails[0].value;
        const sub = profile.id;
        void getOrCreateUser(email, sub, done).then();
      }));

    setGoogleRoutes(app);
}

const getOrCreateUser = async (email: string, sub: string, done: VerifyFunction): Promise<void> => {
    const user = await UserService.retrieveUserByEmail(email);
    if (user) {
      return done(null, user);
    } else {
      try {
        await UserService.createUser(sub, email);
        return done(undefined, await UserService.retrieveUserByEmail(email));
      } catch (err) {
        return done(err);
      }
    }
}

const setGoogleRoutes = (app: express.Express): void => {
    app.get('/auth/google',
        passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

    app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
    (req, res) => {
        const user: IUser = req.user as IUser;
        const accessToken = generateAccessToken(user);
        res.cookie(jwtKeyInCookie, accessToken, {httpOnly: true})
        .redirect(config.authentication.redirectURL);
    });
}

const generateAccessToken = (user: IUser): string => {
    const secret = config.authentication.jwtSecret;
    const token = jwt.sign({}, secret, {
      subject: user.id
    })

    return token;
  }

