import { ResourceAlreadyExistsError, InvalidInputError, UserDoesNotExistsError } from '../../src/errors/customErrors';
import { setupDatabaseForTests, emptyActivityTable } from '@Tests/fixtures/db';
import * as ActivityService from '@App/components/activity/activityService';
import * as ActivityDAL from '@App/components/activity/activityDAL';
import db from '@App/modules/database/db';
import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';
import { dummyActivityArn } from '@Tests/testHelper';
import { IActivity, ActivityTable } from '@App/components/activity/activity.interfaces';
import { InvalidNameError, InvalidArnError } from '@App/errors/AWSErrors';

describe('activity service', () => {
    let user: IUser;
    const badlyFormedArnCases = [null, undefined, '', 10, 'badlyFormedArn', 'arn:aws:states:us-east-1:999999999999:activity:' + 'a'.repeat(210)];

    beforeAll(async () => {
        await setupDatabaseForTests();
        user = await UserService.createUser('sub', 'tmp@gmail.com');
    });

    beforeEach(async () => {
        await emptyActivityTable();
    });
    describe('create activities', () => {

        it("should correctly create an activity", async () => {
            expect.assertions(3);
            const activityName = 'name';
    
            const createdActivity = await ActivityService.createActivity(user.id, activityName);
            const activityFromDb = await ActivityDAL.selectActivityByName(db, activityName);
    
            expect(createdActivity.name).toBe(activityName);
            expect(activityFromDb.name).toBe(activityName);
            expect(createdActivity.creationDate).toStrictEqual(activityFromDb.creationDate);
        });
     
        it.each([undefined, null, '', 'salut'])("should throw if the user id is %p", async(userId: string) => { 
            expect.assertions(1);
            await expect(ActivityService.createActivity(userId, 'name')).rejects.toThrow(UserDoesNotExistsError);
        });
    
        const badActivityNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]
        it.each(badActivityNameCases)("expects '%p' to be an activity name with an invalid character", async (activityName: string) => {
            expect.assertions(1);
            await expect(ActivityService.createActivity(user.id, activityName)).rejects.toThrow(InvalidNameError);
        });
    
        it.each([0, 81, 100])("expects that an activity name with a length of '%p' is invalid", async (activityNameLength: number) => {
            expect.assertions(1);
            const activityName = "a".repeat(activityNameLength);
            await expect(ActivityService.createActivity(user.id, activityName)).rejects.toThrow(InvalidNameError);
        });
    
        it("should not create an activity if the name is already taken", async () => {
            expect.assertions(3);

            const activityName = 'name';
            const firstActivity = await ActivityService.createActivity(user.id, activityName);
            const secondActivity = await ActivityService.createActivity(user.id, activityName)
            const numberOfActivitiesInDb = await db(ActivityTable.tableName).count();

            expect(firstActivity).toBeDefined();
            expect(secondActivity).toStrictEqual(firstActivity);
            expect(numberOfActivitiesInDb[0]['count']).toBe('1');
        });
    })
    
    describe('delete activity', () => {
    
        it('should correctly delete an activity', async () => {
            expect.assertions(2);
    
            const createdActivity = await ActivityService.createActivity(user.id, 'name');
    
            const activityBeforeDeletion = await ActivityDAL.selectActivityByArn(db, createdActivity.activityArn);
            await ActivityService.deleteActivity(createdActivity.activityArn);
            const activityAfterDeletion = await ActivityDAL.selectActivityByArn(db, createdActivity.activityArn);
    
            expect(activityBeforeDeletion).toBeDefined();
            expect(activityAfterDeletion).toBeUndefined();
        });
    
        it('should send false if the activity to delete does not exists', async () => {
            expect.assertions(1);
            const dummyArn = 'arn:aws:states:us-east-1:999999999999:activity:name'
            const result = await ActivityService.deleteActivity(dummyArn);
            expect(result).toBe(false);
        });

        it.each(badlyFormedArnCases)('should throw if the arn is %p', async (activityArn: string) => {
            expect.assertions(1);
    
            await expect(ActivityService.deleteActivity(activityArn)).rejects.toThrow(InvalidArnError);
        });
    });

    describe('get activity', () => {
        it('should correctly retrieve an activity', async () => {
            expect.assertions(4);

            const activityName = 'name';
            const createdActivity = await ActivityService.createActivity(user.id, activityName);
            const retrieveActivity = await ActivityService.getActivity(createdActivity.activityArn);

            expect(retrieveActivity).toBeDefined();
            expect(retrieveActivity.activityArn).toBe(createdActivity.activityArn);
            expect(retrieveActivity.name).toBe(activityName);
            expect(retrieveActivity.creationDate).toBeDefined();
        });

        it.each(badlyFormedArnCases)('should throw if the arn is %p', async (activityArn: string) => {
            expect.assertions(1);

            await expect(ActivityService.getActivity(activityArn)).rejects.toThrow(InvalidArnError);
        });

        it('shoud send undefined if the activity is well formed but does not exists', async () => {
            expect.assertions(1);

            const result = await ActivityService.getActivity(dummyActivityArn);

            expect(result).toBeUndefined();
        });
    });

    describe('list activities', () => {
        const createActivities = async(numberOfActivitesToCreate: number): Promise<IActivity[]> => {
            const toReturn: IActivity[] = [];
            for (let i = 0; i < numberOfActivitesToCreate; i++) {
                const activityName = `name${i.toString().padStart(3, "0")}`
                toReturn.push(await ActivityService.createActivity(user.id, activityName));
            }
            return toReturn;
        };

        it('should correctly retrieve activities', async () => {
            expect.assertions(4);

            const numberOfActivities = 10;
            await createActivities(numberOfActivities);
            const {activities, nextToken} = await ActivityService.listActivities();

            expect(activities).toHaveLength(numberOfActivities);
            expect(activities[0].name).toBe('name000');
            expect(activities[9].name).toBe('name009');
            expect(nextToken).toBeNull();
        });

        it('should correctly retrieve a subset of activities', async () => {
            expect.assertions(4);

            const maxResults = 5;
            await createActivities(100);
            const {activities, nextToken} = await ActivityService.listActivities({maxResults});

            expect(activities).toHaveLength(maxResults);
            expect(activities[0].name).toBe('name000');
            expect(activities[4].name).toBe('name004');
            expect(nextToken).toBe('5')
        });

        it('should correctly retrieve the last activities', async () => {
            expect.assertions(4);

            await createActivities(100);
            const {activities, nextToken} = await ActivityService.listActivities({maxResults: 70, nextToken: '50'});

            expect(activities).toHaveLength(50);
            expect(activities[0].name).toBe('name050');
            expect(activities[49].name).toBe('name099');
            expect(nextToken).toBeNull();
        });

        it.each(['', 'a', -1, 1001])('max result with a value of %p should throw', async(maxResults: number) => {
            expect.assertions(1)

            await expect(ActivityService.listActivities({maxResults})).rejects.toThrow(InvalidInputError);
        });

        it.each([10, '', '1'.repeat(1025), 'a'])('should throw if nextToken has a value of %p', async (nextToken: string) => {
            expect.assertions(1)

            await expect(ActivityService.listActivities({nextToken})).rejects.toThrow(InvalidInputError);
        });
        
        it('should send an empty array and a null nextToken if there is no activities', async () => {
            expect.assertions(2);

            const {activities, nextToken} = await ActivityService.listActivities();

            expect(activities).toHaveLength(0);
            expect(nextToken).toBeNull();
        });

        it('should throw if the nextToken is too high', async () => {
            expect.assertions(1);

            await expect(ActivityService.listActivities({nextToken: '100'})).rejects.toThrow(InvalidInputError);
        });

        it('shoud throw if the nextToken has the same value as the number of activities', async () => {
            expect.assertions(1);

            await createActivities(10);

            await expect(ActivityService.listActivities({nextToken: '10'})).rejects.toThrow(InvalidInputError);

        });
    });
});
