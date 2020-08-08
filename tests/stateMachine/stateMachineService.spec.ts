import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import { setupDatabaseForTests, emptyStateMachineTable, countRowInTable } from '@Tests/fixtures/db';
import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';
import { InvalidNameError, InvalidArnError, StateMachineTypeNotSupportedError, StateMachineAlreadyExistsError, StateMachineDoesNotExistsError, InvalidTokenError, MissingRequiredParameterError, InvalidDefinitionError } from '@App/errors/AWSErrors';
import { stateMachinesForTests, dummyRoleARN, dummyId, dummyStateMachineArn, badlyFormedArnCases } from '@Tests/testHelper';
import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import { UserDoesNotExistsError, InvalidInputError } from '@App/errors/customErrors';
import { StateMachineTypes, StateMachineTable, IStateMachine, StateMachineVersionTable } from '@App/components/stateMachines/stateMachine.interfaces';

describe('state machines', () => {

    let user: IUser;

    beforeAll(async () => {
        await setupDatabaseForTests();
        user = await UserService.createUser('sub', 'tmp@gmail.com');
    });

    beforeEach(async () => {
        await emptyStateMachineTable();
    })

    const createStateMachinesHelper = async (numberOfStateMachinesToCreate: number): Promise<IStateMachine[]> => {
        const toReturn: IStateMachine[] = []
        for (let i = 0; i < numberOfStateMachinesToCreate; i++) {
            toReturn.push(await StateMachineService.createStateMachine(user.id, {
                definition: stateMachinesForTests.valid.validHelloWorld,
                name: `name${i.toString().padStart(3, "0")}`,
                roleArn: dummyRoleARN,
            }))
        }

        return toReturn;
    }

    describe('create', () => {
        it('should correctly create a state machine', async () => {
            expect.assertions(9);
    
            const name = 'name';
            const definition = stateMachinesForTests.valid.validHelloWorld;
            const createdStateMachine = await StateMachineService.createStateMachine(user.id, {
                definition,
                name,
                roleArn: dummyRoleARN,
            });
    
            expect(createdStateMachine).toBeDefined();
            expect(createdStateMachine.name).toBe(name);
            expect(createdStateMachine.arn).toBeDefined();
            expect(createdStateMachine.creationDate).toBeDefined();
            expect(createdStateMachine.definition).toStrictEqual(JSON.parse(definition));
            expect(createdStateMachine.roleArn).toBe(dummyRoleARN);
            expect(createdStateMachine.status).toBe('ACTIVE');
            expect(createdStateMachine.type).toBe('STANDARD');
            expect(await countRowInTable(StateMachineVersionTable.tableName)).toBe(1);
        });
    
        it('should corretly create a state machine with an EXPRESS type', async () => {
            expect.assertions(2);
    
            const type = StateMachineTypes.express;
            const createdStateMachine = await StateMachineService.createStateMachine(user.id, {
                definition: stateMachinesForTests.valid.validHelloWorld,
                name: 'name',
                roleArn: dummyRoleARN,
                type
            });
    
            expect(createdStateMachine).toBeDefined();
            expect(createdStateMachine.type).toBe(type);
        });
    
        it('should do nothing if the state machine already exists', async () => {
            expect.assertions(2);
    
            const req: CreateStateMachineInput = {
                definition: stateMachinesForTests.valid.validHelloWorld,
                name: 'name',
                roleArn: dummyRoleARN,
            }
            const firstStateMachine = await StateMachineService.createStateMachine(user.id, req);
            const secondStateMachine = await StateMachineService.createStateMachine(user.id, req);
            const stateMachineNumberInDb = await countRowInTable(StateMachineTable.tableName);
    
            expect(firstStateMachine).toStrictEqual(secondStateMachine);
            expect(stateMachineNumberInDb).toBe(1);
        });
    
        it('should throw if a state machine with the same name and a different definition exists', async () => {
            expect.assertions(1);
    
            const req: CreateStateMachineInput = {
                definition: stateMachinesForTests.valid.validHelloWorld,
                name: 'name',
                roleArn: dummyRoleARN,
            }
            await StateMachineService.createStateMachine(user.id, req);
            req.definition = stateMachinesForTests.valid.validPassState;
    
            await expect(StateMachineService.createStateMachine(user.id, req)).rejects.toThrow(StateMachineAlreadyExistsError);
        });
    
        it('should throw if a state machine with the same name and a different role arn exists', async () => {
            expect.assertions(1);
    
            const req: CreateStateMachineInput = {
                definition: stateMachinesForTests.valid.validHelloWorld,
                name: 'name',
                roleArn: dummyRoleARN,
            }
            await StateMachineService.createStateMachine(user.id, req);
            req.roleArn = 'arn:aws:iam::012345678901:role/otherRole'
    
            await expect(StateMachineService.createStateMachine(user.id, req)).rejects.toThrow(StateMachineAlreadyExistsError);
        });
    
        it('should throw if the user id is invalid', async () => {
            expect.assertions(1);
            const req: CreateStateMachineInput = {
                definition: stateMachinesForTests.valid.validHelloWorld,
                name: 'name',
                roleArn: dummyRoleARN,
            };
    
            await expect(StateMachineService.createStateMachine(dummyId, req)).rejects.toThrow(UserDoesNotExistsError);
        });
    
        it('should throw if the state machine type is neither STANDARD nor EXPRESS', async () => {
            expect.assertions(1);
    
            const req: CreateStateMachineInput = {
                definition: stateMachinesForTests.valid.validHelloWorld,
                name: 'name',
                roleArn: dummyRoleARN,
                type: 'badType'
            };
    
            await expect(StateMachineService.createStateMachine(user.id, req)).rejects.toThrow(StateMachineTypeNotSupportedError);
        });
    
        const badSMNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]
        it.each([badSMNameCases])('should throw if the state machine name is %p', async (name: string) => {
            expect.assertions(1);
            const definition = stateMachinesForTests.valid.validHelloWorld;
            await expect(StateMachineService.createStateMachine(user.id, {name,definition,roleArn: dummyRoleARN})).rejects.toThrow(InvalidNameError);
        });
    
        it.each([badlyFormedArnCases])('should throw if the state machine role arn is %p', async (roleArn: string) => {
            const definition = stateMachinesForTests.valid.validHelloWorld;
            await expect(StateMachineService.createStateMachine(user.id, {name: 'name',definition,roleArn})).rejects.toThrow(InvalidArnError);
        });
    });

    

    describe('delete', () => {
        it('should correctly delete a state machine', async () => {
            expect.assertions(4);

            const createdStateMachine = (await createStateMachinesHelper(1))[0];

            const numberOfSmInDbBefore = await countRowInTable(StateMachineTable.tableName);
            const result = await StateMachineService.deleteStateMachine({stateMachineArn: createdStateMachine.arn});
            const numberOfSmInDbAfter = await countRowInTable(StateMachineTable.tableName);

            expect(numberOfSmInDbBefore).toBe(1);
            expect(result).toBe(true);
            expect(numberOfSmInDbAfter).toBe(0);
            expect(await countRowInTable(StateMachineVersionTable.tableName)).toBe(0);
        });

        it('should do nothing if the deleted state machine does not exists', async () => {
            expect.assertions(2);

            await createStateMachinesHelper(1);

            const result = await StateMachineService.deleteStateMachine({stateMachineArn: dummyStateMachineArn});
            const numberOfStateMachines = await countRowInTable(StateMachineTable.tableName);

            expect(result).toBe(false);
            expect(numberOfStateMachines).toBe(1);
        })

        it('should throw if the state machine arn is invalid', async () => {
            expect.assertions(1);

            await expect(StateMachineService.deleteStateMachine({stateMachineArn: 'badArn'})).rejects.toThrow(InvalidArnError);
        });
    });

    describe('select one state machine', () => {

        it('should correctly retrieve a state machine', async () => {
            expect.assertions(2);

            const createdStateMachine = (await createStateMachinesHelper(1))[0];

            const retrievedStateMachine = await StateMachineService.describeStateMachine({stateMachineArn: createdStateMachine.arn});

            expect(retrievedStateMachine).toBeDefined();
            expect(retrievedStateMachine).toStrictEqual(createdStateMachine);

        });

        it('should throw if the state machine arn is invalid', async () => {
            expect.assertions(1);

            await expect(StateMachineService.describeStateMachine({stateMachineArn: 'badArn'})).rejects.toThrow(InvalidArnError);
        });

        it('should throw if the state machine does not exists', async () => {
            expect.assertions(1);
            const unexistingStateMachineArn = 'arn:aws:states:us-east-1:123456789012:stateMachine:unexistingArn';
            await expect(StateMachineService.describeStateMachine({stateMachineArn: unexistingStateMachineArn})).rejects.toThrow(StateMachineDoesNotExistsError);
        });
    })

    describe('list state machines', () => {

        it('should correctly retrieve state machines', async () => {
            expect.assertions(4);

            const numberOfStateMachines = 10;
            await createStateMachinesHelper(numberOfStateMachines);
            const {resources, nextToken} = await StateMachineService.listStateMachines();

            expect(resources).toHaveLength(numberOfStateMachines);
            expect(resources[0].name).toBe('name000');
            expect(resources[9].name).toBe('name009');
            expect(nextToken).toBeNull();
        });

        it('should correctly retrieve a subset of state machines', async () => {
            expect.assertions(4);

            const maxResults = 5;
            await createStateMachinesHelper(100);
            const {resources, nextToken} = await StateMachineService.listStateMachines({maxResults});

            expect(resources).toHaveLength(maxResults);
            expect(resources[0].name).toBe('name000');
            expect(resources[4].name).toBe('name004');
            expect(nextToken).toBe('5')
        });

        it('should correctly retrieve the last state machines', async () => {
            expect.assertions(4);

            await createStateMachinesHelper(100);
            const {resources, nextToken} = await StateMachineService.listStateMachines({maxResults: 70, nextToken: '50'});

            expect(resources).toHaveLength(50);
            expect(resources[0].name).toBe('name050');
            expect(resources[49].name).toBe('name099');
            expect(nextToken).toBeNull();
        });

        it.each(['', 'a', -1, 1001])('max result with a value of %p should throw', async(maxResults: number) => {
            expect.assertions(1)

            await expect(StateMachineService.listStateMachines({maxResults})).rejects.toThrow(InvalidInputError);
        });

        it.each([10, '', '1'.repeat(1025), 'a'])('should throw if nextToken has a value of %p', async (nextToken: string) => {
            expect.assertions(1)

            await expect(StateMachineService.listStateMachines({nextToken})).rejects.toThrow(InvalidTokenError);
        });
        
        it('should send an empty array and a null nextToken if there is no state machines', async () => {
            expect.assertions(2);

            const {resources, nextToken} = await StateMachineService.listStateMachines();

            expect(resources).toHaveLength(0);
            expect(nextToken).toBeNull();
        });

        it('should throw if the nextToken is too high', async () => {
            expect.assertions(1);

            await expect(StateMachineService.listStateMachines({nextToken: '100'})).rejects.toThrow(InvalidTokenError);
        });

        it('shoud throw if the nextToken has the same value as the number of state machines', async () => {
            expect.assertions(1);

            await createStateMachinesHelper(10);

            await expect(StateMachineService.listStateMachines({nextToken: '10'})).rejects.toThrow(InvalidTokenError);

        });
    });

    describe('update state machine', () => {

        it('should correctly update the state machine definition', async () => {
            expect.assertions(5);

            const stateMachine = (await createStateMachinesHelper(1))[0];
            const newDefinition = stateMachinesForTests.valid.validWaitState;

            const updateDate = await StateMachineService.updateStateMachine({
                stateMachineArn: stateMachine.arn,
                definition: newDefinition
            });
            
            const updatedStateMachine = await StateMachineService.describeStateMachine({stateMachineArn: stateMachine.arn});
            const numberOfStateMachine = await countRowInTable(StateMachineTable.tableName);
            const numberOfUpdate = await countRowInTable(StateMachineVersionTable.tableName);

            expect(stateMachine.definition).toStrictEqual(JSON.parse(stateMachinesForTests.valid.validHelloWorld));
            expect(updateDate).toBeDefined();
            expect(updatedStateMachine.definition).toStrictEqual(JSON.parse(newDefinition));
            expect(numberOfStateMachine).toBe(1);
            expect(numberOfUpdate).toBe(2);
        });

        it('should correctly update the state machine arn', async () => {
            expect.assertions(2);

            const stateMachine = (await createStateMachinesHelper(1))[0];
            const newRoleArn = 'arn:aws:iam::012345678901:role/newRole';

            const updateDate = await StateMachineService.updateStateMachine({
                stateMachineArn: stateMachine.arn,
                roleArn: newRoleArn
            });

            const updatedStateMachine = await StateMachineService.describeStateMachine({stateMachineArn: stateMachine.arn});

            expect(updateDate).toBeDefined();
            expect(updatedStateMachine.roleArn).toBe(newRoleArn);
        });

        it('should correctly update both the state machine definition and role', async () => {
            expect.assertions(3);

            const stateMachine = (await createStateMachinesHelper(1))[0];
            const newRoleArn = 'arn:aws:iam::012345678901:role/newRole';
            const newDefinition = stateMachinesForTests.valid.validWaitState;
            const updatedDate = await StateMachineService.updateStateMachine({stateMachineArn: stateMachine.arn, roleArn: newRoleArn, definition: newDefinition});

            const updatedStateMachine = await StateMachineService.describeStateMachine({stateMachineArn: stateMachine.arn});

            expect(updatedDate).toBeDefined();
            expect(updatedStateMachine.definition).toStrictEqual(JSON.parse(newDefinition))
            expect(updatedStateMachine.roleArn).toBe(newRoleArn);
        })

        it('should fail if both the roleArn and the definition are undefined', async () => {
            expect.assertions(1);

            const stateMachine = (await createStateMachinesHelper(1))[0];
            await expect(StateMachineService.updateStateMachine({stateMachineArn: stateMachine.arn})).rejects.toThrow(MissingRequiredParameterError);
        });

        it('should throw if the new role arn is not valid', async () => {
            expect.assertions(1);

            const stateMachine = (await createStateMachinesHelper(1))[0];

            await expect(StateMachineService.updateStateMachine({stateMachineArn: stateMachine.arn, roleArn: 'badArn'})).rejects.toThrow(InvalidArnError);
        });
        
        it('should throw if the definition is %p', async () => {
            expect.assertions(1);

            const stateMachine = (await createStateMachinesHelper(1))[0];

            await expect(StateMachineService.updateStateMachine({stateMachineArn: stateMachine.arn, definition: '{}'})).rejects.toThrow(InvalidDefinitionError);
        })

        it('should throw if the state machine does not exists', async () => {
            expect.assertions(1);

            const definition = stateMachinesForTests.valid.validWaitState;

            await expect(StateMachineService.updateStateMachine({stateMachineArn: dummyStateMachineArn, definition})).rejects.toThrow(StateMachineDoesNotExistsError);
        });
    });
    
});