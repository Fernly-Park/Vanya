import * as dbModule from '../../src/modules/database/db';
import { ActivityTable } from '../../src/modules/database/activityTable.model';
import { UserTable } from '@App/modules/database/userTable.model';

export const setupDatabaseForTests = async (): Promise<void> => {
    await clearDatabase();
    await dbModule.setupDatabase();
    
};

const clearDatabase = async (): Promise<void> => {
    const db = dbModule.default;
    await db.schema.dropTableIfExists(ActivityTable.tableName);
    await db.schema.dropTableIfExists(UserTable.tableName);
};
