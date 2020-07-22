import { setupDatabase } from '../../src/modules/database/db';
import db from '../../src/modules/database/db';
import { setupDatabaseForTests } from '../fixtures/db';
import { ActivityTable } from '@App/components/activity/activity.interfaces';
import { UserTable } from '@App/components/user/user.interfaces';

describe('ensuring that the setted up database is correct', () => {

    beforeEach(async () => {
        await setupDatabaseForTests();
    });
 
    it('create the activity table', async () => {
        expect.assertions(5);
        await setupDatabase();
        const activitiesTableName = ActivityTable.tableName;
        
        const activitiesTableExists = await db.schema.hasTable(activitiesTableName);
        const hasIdColumn = await db.schema.hasColumn(activitiesTableName, ActivityTable.idColumn);
        const hasNameColumn = await db.schema.hasColumn(activitiesTableName, ActivityTable.nameColumn);
        const hasArnColumn = await db.schema.hasColumn(activitiesTableName, ActivityTable.arnColumn);
        const hasCreationDateColumn = await db.schema.hasColumn(activitiesTableName, ActivityTable.creationDateColumn)

        expect(activitiesTableExists).toBe(true);
        expect(hasIdColumn).toBe(true);
        expect(hasNameColumn).toBe(true);
        expect(hasArnColumn).toBe(true);
        expect(hasCreationDateColumn).toBe(true);
    });

    it('create the users table', async () => {
        expect.assertions(5);
        await setupDatabase();
        
        const usersTableExists = await db.schema.hasTable(UserTable.tableName);
        const hasIdColumn = await db.schema.hasColumn(UserTable.tableName, UserTable.idColumn);
        const hasUsernameColumn = await db.schema.hasColumn(UserTable.tableName, UserTable.emailColumn);
        const hasSecretColumn = await db.schema.hasColumn(UserTable.tableName, UserTable.secretColumn);
        const hasSubColumn = await db.schema.hasColumn(UserTable.tableName, UserTable.subColumn);

        expect(usersTableExists).toBe(true);
        expect(hasIdColumn).toBe(true);
        expect(hasUsernameColumn).toBe(true);
        expect(hasSecretColumn).toBe(true);
        expect(hasSubColumn).toBe(true);
    });
});