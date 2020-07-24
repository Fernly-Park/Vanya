import { ResourceAlreadyExistsError, InvalidInputError } from '../../src/errors/customErrors';
import { setupDatabaseForTests, emptyActivityTable } from '@Tests/fixtures/db';
import * as ActivityService from '@App/components/activity/activityService';
import * as ActivityDAL from '@App/components/activity/activityDAL';
import db from '@App/modules/database/db';
import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';

describe('activity service', () => {
    let user: IUser;
    
    beforeAll(async () => {
        await setupDatabaseForTests();
        user = await UserService.createUser('sub', 'tmp@gmail.com');
    });

    beforeEach(async () => {
        await emptyActivityTable();
    });
    describe('create activities', () => {

        it("should correctly create an activity", async () => {
            expect.assertions(4);
            const activityName = 'name';
    
            const createdActivity = await ActivityService.createActivity(user.id, activityName);
            const activityFromDb = await ActivityDAL.selectActivityByName(db, activityName);
    
            expect(createdActivity.name).toBe(activityName);
            expect(activityFromDb.name).toBe(activityName);
            expect(createdActivity.id).toBe(activityFromDb.id);
            expect(createdActivity.creationDate).toStrictEqual(activityFromDb.creationDate);
        });
    
        it.each([undefined, null, '', 'salut'])("should throw if the user id is %p", async(userId: string) => { 
            expect.assertions(1);
            await expect(ActivityService.createActivity(userId, 'name')).rejects.toThrow(InvalidInputError);
        });
    
        const badActivityNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]
        it.each(badActivityNameCases)("expects '%p' to be an activity name with an invalid character", async (activityName: string) => {
            expect.assertions(1);
            await expect(ActivityService.createActivity(user.id, activityName)).rejects.toThrow(InvalidInputError);
        });
    
        it.each([0, 81, 100])("expects that an activity name with a length of '%p' is invalid", async (activityNameLength: number) => {
            expect.assertions(1);
            const activityName = "a".repeat(activityNameLength);
            await expect(ActivityService.createActivity(user.id, activityName)).rejects.toThrow(InvalidInputError);
        });
    
        it("should not create an activity if the name is already taken", async () => {
            expect.assertions(2);
            const activityName = 'name';
            const activity = await ActivityService.createActivity(user.id, activityName);
    
            expect(activity).toBeDefined();
            await expect(ActivityService.createActivity(user.id, activityName)).rejects.toThrow(ResourceAlreadyExistsError);
        });
    })
    
    describe('delete activity', () => {
    
        it('should correctly delete an activity', async () => {
            expect.assertions(2);
    
            const createdActivity = await ActivityService.createActivity(user.id, 'name');
    
            const activityBeforeDeletion = await ActivityDAL.selectActivityByArn(db, createdActivity.arn);
            await ActivityService.deleteActivity(createdActivity.arn);
            const activityAfterDeletion = await ActivityDAL.selectActivityByArn(db, createdActivity.arn);
    
            expect(activityBeforeDeletion).toBeDefined();
            expect(activityAfterDeletion).toBeUndefined();
        });
    
        it('should send false if the activity to delete does not exists', async () => {
            expect.assertions(1);
            const dummyArn = 'arn:aws:states:us-east-1:999999999999:activity:name'
            const result = await ActivityService.deleteActivity(dummyArn);
            expect(result).toBe(false);
        });
    
        it('should throw if the arn is badly formed', async () => {
            expect.assertions(1);
    
            await expect(ActivityService.deleteActivity('badlyFormedArn')).rejects.toThrow(InvalidInputError);
        });
    });
});
