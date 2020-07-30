import { ensureStateMachineDefinitionIsValid } from "@App/components/stateMachines/asl/ASLHelper";
import {readdirSync, readFileSync} from 'fs';
import {join} from 'path';
import { InvalidInputError } from "@App/errors/customErrors";

describe('state machine validation', () => {
    const definitionsFolder = 'definitions';

    const getStateMachinesDefInFolder = (...folders: string[]) => {
        const files = readdirSync(join(__dirname, ...folders));
        return files.map(fileName => {
            return {
                fileName, 
                value: readFileSync((join(__dirname, ...folders, fileName)), 'utf8')
            };
        });
    };

    const validStateMachinesCases = getStateMachinesDefInFolder(definitionsFolder, 'valid');
    const invalidStateMachineCases = getStateMachinesDefInFolder(definitionsFolder, 'invalid');
    
    validStateMachinesCases.forEach((sm, i) => {
        it(`should correctly validate the state machine ${sm.fileName}`, () => {
            expect.assertions(1);

            expect(() => {ensureStateMachineDefinitionIsValid(sm.value)}).not.toThrow();
        });
    });

    invalidStateMachineCases.forEach((sm, i) => {
        it(`should correctly invalidate the state machine ${sm.fileName}`, () => {
            expect.assertions(1);
            expect(() => {ensureStateMachineDefinitionIsValid(sm.value)}).toThrow(InvalidInputError);
        });  
    });


});
 