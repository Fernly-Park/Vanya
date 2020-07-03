import { setupDatabase } from '../src/modules/database/db';
import db from '../src/modules/database/db';

describe('ensuring that the setted up database is correct', () => {

    it('create the activity table', async () => {
        expect.assertions(4);
        await setupDatabase();
        const activitiesTableName = 'activities';
        
        const activitiesTableExists = await db.schema.hasTable(activitiesTableName);
        const hasIdColumn = await db.schema.hasColumn(activitiesTableName, 'id');
        const hasNameColumn = await db.schema.hasColumn(activitiesTableName, 'name')
        const hasCreatedAtColumn = await db.schema.hasColumn(activitiesTableName, 'created_at')

        expect(activitiesTableExists).toBe(true);
        expect(hasIdColumn).toBe(true);
        expect(hasNameColumn).toBe(true);
        expect(hasCreatedAtColumn).toBe(true);
    });
});