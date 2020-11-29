import * as TestHelper from "@Tests/testHelper";
import { generateServiceTest } from "@Tests/testGenerator";
import { ContextObjectService } from ".";

generateServiceTest({describeText: 'execution', tests: (getUser) => {
    describe('update context object', () => {
        it('should work event if the new state name has spaces', async () => {
            expect.assertions(1);
    
            const {execution} = await TestHelper.createSMAndStartExecutionHelper({userId: getUser().id});
    
            expect(async () => await ContextObjectService.updateContextObject({executionArn: execution.executionArn, enteredState: {EnteredTime: new Date(), Name: 'hello world'}}))
                .not.toThrow()
    
            await ContextObjectService.describeContextObject({executionArn: execution.executionArn, stateName: 'hello world'});
        })
    })
}});
