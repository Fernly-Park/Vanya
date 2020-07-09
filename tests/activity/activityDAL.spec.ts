import * as ActivityModel from "../../src/components/activity/activityDAL"; 
import db from '../../src/modules/database/db';
import { IActivity } from "../../src/components/activity/activity.interfaces";
import { ActivityTable } from '../../src/modules/database/activityTable.model';
import { setupDatabaseForTests } from "@Tests/fixtures/db";

describe('create activity in db', () => {
    
    beforeEach(async () => {
        await setupDatabaseForTests();
    });
    it('correctly create an activity', async () => {
        expect.assertions(3);
        const activtyArn = '999999999999:test';
        const activityName = 'test';
        await ActivityModel.insertActivity(activtyArn, activityName);

        const result = await db.select<IActivity[]>().table(ActivityTable.tableName);

        expect(result).toHaveLength(1);
        expect(result[0].arn).toBe(activtyArn);
        expect(result[0].name).toBe(activityName);
    });

    it('throws an exception when given an undefined activity name', async () => {
        expect.assertions(1);
        
        await expect(ActivityModel.insertActivity('999999999999:test', undefined)).rejects.toThrow();
    });

    it('throws an exception when given an undefined activity arn', async () => {
        expect.assertions(1);
        
        await expect(ActivityModel.insertActivity(undefined, 'test')).rejects.toThrow();
    });
});

describe('select activity from db', () => {

    beforeEach(async () => {
        await setupDatabaseForTests();
    });
    
    const cases = [[ActivityModel.selectActivityByName, 'name'], [ActivityModel.selectActivityByArn, '999999999999:name']];
    it.each(cases)('should select an existing activity', async (selectFunction: ((resource: string) => Promise<IActivity>), resource: string) => {
        expect.assertions(4);

        const activityName = 'name';
        const activityArn = '999999999999:name';

        await db(ActivityTable.tableName).insert({
            [ActivityTable.arnColumn]: activityArn,
            [ActivityTable.nameColumn]: activityName
        });
        const activity = await selectFunction(resource);
        
        expect(activity.id).toBeGreaterThan(0);
        expect(activity.name).toBe(activityName);
        expect(activity.arn).toBe(activityArn);
        expect(activity.creationDate).toBeDefined();
    });

    it.each([ActivityModel.selectActivityByName, ActivityModel.selectActivityByArn])('should return undefined when selecting an unexisting activity', async (selectFunction) => {
        expect.assertions(1);

        const activity = await selectFunction('unexistingActivity');

        expect(activity).toBeUndefined();
    });
})

describe('delete activity from db', () => {
    const activityName = 'test';
    const activityArn = '999999999999:test'
    const retrieveAllActivities = async () => await db.select<IActivity[]>().table(ActivityTable.tableName);

    beforeEach(async () => {
        await setupDatabaseForTests();
        await db(ActivityTable.tableName).insert({
            [ActivityTable.arnColumn]: activityArn,
            [ActivityTable.nameColumn]: activityName
        });
    });

    it('should correctly delete the activity', async () => {
        expect.assertions(5);
        
        const activitiesBeforeDeletion = await retrieveAllActivities();
        const wasDeleted = await ActivityModel.deleteActivityByArn(activityArn);
        const activitiesAfterDeletion = await retrieveAllActivities();

        expect(wasDeleted).toBe(true);

        expect(activitiesBeforeDeletion).toHaveLength(1);
        expect(activitiesBeforeDeletion[0].arn).toBe(activityArn);
        expect(activitiesBeforeDeletion[0].name).toBe(activityName);

        expect(activitiesAfterDeletion).toHaveLength(0);
    });

    it('should do nothing if the activity to delete does not exists', async () => {
        expect.assertions(3);

        const activitiesBeforeDeletion = await retrieveAllActivities();
        const wasDeleted = await ActivityModel.deleteActivityByArn('999999999999:unexistingActivity');
        const activitiesAfterDeletion = await retrieveAllActivities();

        expect(wasDeleted).toBe(false);
        expect(activitiesBeforeDeletion).toHaveLength(1);
        expect(activitiesAfterDeletion).toHaveLength(1);
    });
});
