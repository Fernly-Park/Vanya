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
    });

    it('correctly create an execution arn', () => {
        expect.assertions(1);

        const arn = ArnHelper.generateExecutionArn('123456789012', 'name', '006f371e-4504-46be-ba47-73f88641ad71');

        expect(arn).toBe(`arn:aws:states:${config.region}:123456789012:execution:name:006f371e-4504-46be-ba47-73f88641ad71`);
    });

    it('correctly retrieve the name from a state machine arn', () => {
        expect.assertions(1);

        const name = ArnHelper.retrieveStateMachineNameFromArn('arn:aws:states:us-east-1:123456789012:stateMachine:name');

        expect(name).toBe('name');
    });
});