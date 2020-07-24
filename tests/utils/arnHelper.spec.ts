import * as ArnHelper from "@App/utils/ArnHelper";
import config from '@App/config';

describe('arn helper function', () => {
    it('correctly create an activity ARN', () => {
        expect.assertions(1);

        const userId = '123456789012';
        const activityName = 'name';
        const result = ArnHelper.generateActivityArn(userId, activityName);

        expect(result).toBe(`arn:aws:states:${config.region}:123456789012:activity:name`)
    });

    it('correctly parse an ARN', () => {
        expect.assertions(3)

        const userId = '123456789012'
        const arn = ArnHelper.parseArn(`arn:aws:states:us-east-1:${userId}:activity:name`);
        
        expect(arn.resourceName).toBe('name');
        expect(arn.resourceType).toBe('activity');
        expect(arn.userId).toBe(userId)
    });
});