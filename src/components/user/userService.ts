import { randomIntFromInterval, isANumber } from "@App/utils/numberUtils";
import validator from 'validator';
import { InvalidInputError, ResourceAlreadyExistsError, UserDoesNotExistsError } from "@App/errors/customErrors";
import { isAnEmptyString, isAString } from "@App/utils/stringUtils";
import * as UserDAL from "./userDAL";
import { DbOrTransaction } from "@App/modules/database/db";
import db from '@App/modules/database/db';
import { IUser } from "./user.interfaces";
import * as Logger from '@App/modules/logging';

export const createUser = async (sub: string, email: string): Promise<IUser> => {
    if (!isAString(sub) || isAnEmptyString(sub)) {
        throw new InvalidInputError(`the sub '${sub}' must be a non empty string !`);
    }
    if (!isAString(email) || !validator.isEmail(email)) {
        throw new InvalidInputError(`email '${email}' is invalid`);
    }

    
    return await db.transaction(async (trx) => {
        const alreadyExistingUser = await UserDAL.selectUserByEmail(trx, email);
        if (alreadyExistingUser) {
            throw new ResourceAlreadyExistsError(`The user '${email}' already exists`)
        }
        const clientId = await generateUniqueId(trx);
        Logger.logDebug(`User id for '${email}' generated, value : '${clientId}'`)
        const userToInsert: IUser = {
            id: clientId,
            sub: sub,
            email: email
        }
        await UserDAL.insertUser(trx, userToInsert);
        const createdUser = await UserDAL.selectUserByEmail(trx, userToInsert.email);
        if (!createdUser) {
            throw new Error(`User '${userToInsert.id}' with email '${userToInsert.email}' should have been created`);
        }
        return createdUser;
    });
    
};

const generateUniqueId = async (trx: DbOrTransaction): Promise<string> => {
    let id: string;

    do {
        id = randomIntFromInterval(1, 999999999999).toString().padStart(12, '0');
    }while (await UserDAL.selectUserById(trx, id) !== undefined);

    return id;
};

export const retrieveUserByEmail = async (email: string): Promise<IUser> => {
    if (typeof email !== 'string' || !validator.isEmail(email)) {
        throw new InvalidInputError(`email '${email}' is invalid`);
    }
    return await UserDAL.selectUserByEmail(db, email);
} 

export const retrieveUserById = async(id: string): Promise<IUser> => {
    EnsureUserIdIsWellFormed(id);
    Logger.logDebug(`retrieving user '${id}'`);
    
    return await UserDAL.selectUserById(db, id);
};

export const setUserSecret = async(id: string, secret: string): Promise<void> => {
    EnsureUserIdIsWellFormed(id);
    await db.transaction(async (trx) => {
        const user = await UserDAL.selectUserById(trx, id);
        if (!user) {
            throw new InvalidInputError(`user with id '${id}' does not exists`)
        }
        await UserDAL.updateUserSecret(trx, id, secret);
    });
};

export const EnsureUserExists = async (id: string): Promise<void> => {
    if (!id || typeof(id) !== 'string' || !await retrieveUserById(id)) {
        throw new UserDoesNotExistsError(`user with id '${id}' does not exists`);
    }
};

const EnsureUserIdIsWellFormed = (id: string): void => {
    if (typeof id !== 'string' || id.length != 12 || !isANumber(id)) {
        throw new UserDoesNotExistsError(`'${id}' is not a valid user id`);
    }
}