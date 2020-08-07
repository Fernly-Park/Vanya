import { DbOrTransaction } from "@App/modules/database/db";

export const countResourceFactory = (tableName: string) => {
    return async (db: DbOrTransaction): Promise<number> => {
        const result = await db(tableName).count();
        return +result[0].count;
    }
}

export const selectResourceFactory = <T>(tableName: string, columnName: string) => {
    return async (db: DbOrTransaction, value: string): Promise<T> => {
        return await db(tableName).where(columnName, value).first() as T;
    }
}

export const selectArrayOfResourcesFactory = <T> (tableName: string, columnToOrderBy: string) => {
    return async (db: DbOrTransaction, limit: number, offset: number): Promise<T[]> => {
        return await db(tableName).orderBy(columnToOrderBy).limit(limit).offset(offset) as T[];
    }
}

export const deleteResourceFactory = (tableName: string, columnName: string) => {
    return async (db: DbOrTransaction, value: string): Promise<boolean> => {
        const result = await db(tableName)
        .where(columnName, value)
        .delete();

        return result > 0;
    };
}
