import { randomIntFromInterval } from "@App/utils/numberUtils";
import validator from 'validator';
import { InvalidInputError, ResourceAlreadyExistsError } from "@App/errors/customErrors";
import { isAnEmptyString, isAString } from "@App/utils/stringUtils";
import * as UserDAL from "./userDAL";
import { DbOrTransaction } from "@App/modules/database/db";
import db from '@App/modules/database/db';
import { IUser } from "./user.interfaces";
import * as Logger from '@App/modules/logging';

export const createUser = async (sub: string, email: string): Promise<void> => {
    if (!isAString(sub) || isAnEmptyString(sub)) {
        throw new InvalidInputError(`the sub '${sub}' must be a non empty string !`);
    }
    if (!isAString(email) || !validator.isEmail(email)) {
        throw new InvalidInputError(`email '${email}' is invalid`);
    }

    
    await db.transaction(async (trx) => {
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
    });
    
};

const generateUniqueId = async (trx: DbOrTransaction): Promise<string> => {
    let id: string;

    do {
        id = randomIntFromInterval(1, 999999999999).toString();
    }while (await UserDAL.selectUserById(trx, id) !== undefined);

    return id;
};

export const retrieveUserByEmail = async (email: string): Promise<IUser> => {
    if (!validator.isEmail(email)) {
        throw new InvalidInputError(`email '${email}' is invalid`);
    }
    const toReturn = await UserDAL.selectUserByEmail(db, email);
    return toReturn;
} 