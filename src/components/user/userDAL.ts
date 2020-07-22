import { DbOrTransaction } from '../../modules/database/db';
import * as logger from '../../modules/logging';
import { IUser, UserTable } from './user.interfaces';

export const insertUser = async (db: DbOrTransaction, user: IUser): Promise<void> => {
    logger.logDebug('inserting user in database');
    await db(UserTable.tableName).insert({
        [UserTable.idColumn]: user.id,
        [UserTable.secretColumn]: user.secret,
        [UserTable.subColumn]: user.sub,
        [UserTable.emailColumn]: user.email
    });
    logger.logInfo(`user '${user.id}' registered in database`);
};

export const selectUserById = async (db: DbOrTransaction, id: string): Promise<IUser> => {
    return db<IUser>(UserTable.tableName).where(UserTable.idColumn, id).first();
};

export const selectUserByEmail = async (db: DbOrTransaction, email: string): Promise<IUser> => {
    return db<IUser>(UserTable.tableName).where(UserTable.emailColumn, email).first();
}