import { insertActivity, selectActivityByName } from "../../src/models/activityModel"; 
import db from '../../src/modules/database/db';
import { IActivity } from "../../src/interfaces/iActivity.model";
import { ActivityTable } from '../../src/modules/database/activityTable.model';
import { setupDatabaseForTests } from "@Tests/fixtures/db";

describe('create activity in db', () => {
    
    beforeEach(async () => {
        await setupDatabaseForTests();
    });
    it('correctly create an activity', async () => {
        expect.assertions(2);
        
        await insertActivity('test');
        const result = await db.select<IActivity[]>().table(ActivityTable.tableName);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('test');
    });

    it('throws an exception when given an empty activity name', async () => {
        expect.assertions(1);
        
        await expect(insertActivity(undefined)).rejects.toThrow();
    });
});

describe('select activity from db', () => {
    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    it('should select an existing activity', async () => {
        expect.assertions(3);

        const activityName = 'name';

        await db(ActivityTable.tableName).insert({[ActivityTable.nameColumn]: activityName});
        const activity = await selectActivityByName(activityName);
        
        expect(activity.id).toBeGreaterThan(0);
        expect(activity.name).toBe(activityName);
        expect(activity.createdAt).toBeDefined();
    });

    it('should return undefined when selecting an unexisting activity', async () => {
        expect.assertions(1);

        const activity = await selectActivityByName('unexistingActivity');

        expect(activity).toBeUndefined();
    });
})