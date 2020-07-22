import * as dbModule from '../../src/modules/database/db';
import { ActivityTable } from '../../src/components/activity/activity.interfaces';
import { UserTable } from '@App/components/user/user.interfaces';

export const setupDatabaseForTests = async (): Promise<void> => {
    await clearDatabase();
    await dbModule.setupDatabase();
    
};

const clearDatabase = async (): Promise<void> => {
    const db = dbModule.default;
    await db.schema.dropTableIfExists(ActivityTable.tableName);
    await db.schema.dropTableIfExists(UserTable.tableName);
};
