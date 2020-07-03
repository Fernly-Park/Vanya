import { createActivity } from '../../src/services/activityService';
import { InvalidNameError } from '../../src/errors/customErrors';

describe('create activities service', () => {
    const badActivityNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]
    it.each(badActivityNameCases)("expects '%p' to be an activity name with an invalid character", async (activityName: string) => {
        expect.assertions(1);
        await expect(createActivity(activityName)).rejects.toThrow(InvalidNameError);
    });

    it.each([0, 81, 100])("expects that an activity name with a length of '%p' is invalid", async (activityNameLength: number) => {
        expect.assertions(1);
        await expect(createActivity("a".repeat(activityNameLength))).rejects.toThrow(InvalidNameError);
    });
})
