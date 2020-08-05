import { ensureStateMachineDefinitionIsValid } from "@App/components/stateMachines/asl/ASLHelper";
import { InvalidInputError } from "@App/errors/customErrors";
import { stateMachinesForTests } from "@Tests/testHelper";

describe('state machine validation', () => {

    
    for (const [smName, smDef] of Object.entries(stateMachinesForTests.valid)) {
        it(`should correctly validate the state machine ${smName}`, () => {
            expect.assertions(1);

            expect(() => {ensureStateMachineDefinitionIsValid(smDef)}).not.toThrow();
        });
    }

    for (const [smName, smDef] of Object.entries(stateMachinesForTests.invalid)) {
        it(`should correctly invalidate the state machine ${smName}`, () => {
            expect.assertions(1);
            expect(() => {ensureStateMachineDefinitionIsValid(smDef)}).toThrow();
        });  
    }
});
 