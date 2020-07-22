import { InvalidNameError, ResourceAlreadyExistsError } from '../../src/errors/customErrors';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import { createActivity } from '@App/components/activity/activityService';
import { selectActivityByName } from '@App/components/activity/activityDAL';
import db from '@App/modules/database/db';

describe('create activities service', () => {

    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    it("should correctly create an activity", async () => {
        expect.assertions(4);
        const activityName = 'name';

        const createdActivity = await createActivity(activityName);
        const activityFromDb = await selectActivityByName(db, activityName);

        expect(createdActivity.name).toBe(activityName);
        expect(activityFromDb.name).toBe(activityName);
        expect(createdActivity.id).toBe(activityFromDb.id);
        expect(createdActivity.creationDate).toStrictEqual(activityFromDb.creationDate);
    });

    const badActivityNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]
    it.each(badActivityNameCases)("expects '%p' to be an activity name with an invalid character", async (activityName: string) => {
        expect.assertions(1);
        await expect(createActivity(activityName)).rejects.toThrow(InvalidNameError);
    });

    it.each([0, 81, 100])("expects that an activity name with a length of '%p' is invalid", async (activityNameLength: number) => {
        expect.assertions(1);
        const activityName = "a".repeat(activityNameLength);
        await expect(createActivity(activityName)).rejects.toThrow(InvalidNameError);
    });

    it("should not create an activity if the name is already taken", async () => {
        expect.assertions(2);
        const activityName = 'name';
        const activity = await createActivity(activityName);

        expect(activity).toBeDefined();
        await expect(createActivity(activityName)).rejects.toThrow(ResourceAlreadyExistsError);
    });
})
