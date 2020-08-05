import * as ArnHelper from "@App/utils/ArnHelper";
import config from '@App/config';
import { dummyRoleARN } from "@Tests/testHelper";

describe('arn helper function', () => {
    it('correctly create an activity ARN', () => {
        expect.assertions(1);

        const userId = '123456789012';
        const activityName = 'name';
        const result = ArnHelper.generateActivityArn(userId, activityName);

        expect(result).toBe(`arn:aws:states:${config.region}:123456789012:activity:name`)
    });

    it('correctly parse an activity ARN', () => {
        expect.assertions(3)

        const userId = '123456789012'
        const arn = ArnHelper.parseArn(`arn:aws:states:us-east-1:${userId}:activity:name`);
        
        expect(arn.resourceId).toBe('name');
        expect(arn.resourceType).toBe('activity');
        expect(arn.userId).toBe(userId)
    });

    it('correctly parse a role arn', () => {
        expect.assertions(3);

        const parsedArn = ArnHelper.parseArn(dummyRoleARN);

        expect(parsedArn).toBeDefined();
        expect(parsedArn.userId).toBe('012345678901');
        expect(parsedArn.resourceId).toBe('DummyRole');
    })
});