import { setupDatabaseForTests } from '@Tests/fixtures/db';
import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";

import AWS from 'aws-sdk';
import initApp from '@App/app';
import http from 'http';
import config from '@App/config';
import * as UserService from '@App/components/user/userService';
import { stateMachinesForTests, dummyRoleARN, dummyStateMachineArn } from '@Tests/testHelper';
import { HttpStatusCode } from '@App/utils/httpStatusCode';


describe('state machine tests', () => {
    let server: http.Server;
    let stepFunctions: AWS.StepFunctions;

    beforeAll(async done => {
        const app = await initApp()
        server = http.createServer(app);
        server.listen(3000, 'localhost', 511, done);
    });

    beforeEach(async () => {
        await setupDatabaseForTests();
        const secret = 'secret';
        const user = await UserService.createUser('sub', 'tmp@gmail.com');
        await UserService.setUserSecret(user.id, secret);
        stepFunctions = new AWS.StepFunctions({
            endpoint: `http://localhost:${config.port}`,
            region: config.region,
            credentials: new AWS.Credentials({accessKeyId: user.id, secretAccessKey: secret})
        });
    });

    afterAll(done => {
        server.close(done);
    });

    describe('create state machine', () => {
        it('should correctly create a state machine', async () => {
            expect.assertions(3);

            const req: CreateStateMachineInput = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };
            const resp = await stepFunctions.createStateMachine(req).promise();

            expect(resp).toBeDefined();
            expect(resp.creationDate).toBeDefined();
            expect(resp.stateMachineArn).toBeDefined();
        });

        it('should send an invalid arn and a 400 error response if the role arn is invalid', async () => {
            expect.assertions(1);

            const req = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: 'badArn'
            };

            await expect(stepFunctions.createStateMachine(req).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'InvalidArn',
            }));
        });

        it('should throw when sending a bad definition', async () => {
            expect.assertions(1);

            const req = {
                name: 'name',
                definition: stateMachinesForTests.invalid.invalidErrorEquals,
                roleArn: dummyRoleARN
            };

            await expect(stepFunctions.createStateMachine(req).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'InvalidDefinition',
            }));            
        });

        it('should throw when using an invalid name', async () => {
            expect.assertions(1);

            const req = {
                name: '',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };

            await expect(stepFunctions.createStateMachine(req).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                message: `Invalid Name: '${req.name}'`,
                code: 'InvalidName',
            }));
        });

        it('should throw when the a state machine with the same name but a different definition exists', async () => {
            expect.assertions(1);

            const req = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };

            const stateMachine = await stepFunctions.createStateMachine(req).promise();
            req.definition = stateMachinesForTests.valid.validHelloWorld;
            
            await expect(stepFunctions.createStateMachine(req).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                message: `State Machine Already Exists: '${stateMachine.stateMachineArn}'`,
                code: 'StateMachineAlreadyExists',
            }));
        });

        it('should throw when the a state machine with the same name but a different role arn exists', async () => {
            expect.assertions(1);

            const req = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };

            const stateMachine = await stepFunctions.createStateMachine(req).promise();
            req.roleArn = 'arn:aws:iam::012345678901:role/changedRole';
            
            await expect(stepFunctions.createStateMachine(req).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                message: `State Machine Already Exists: '${stateMachine.stateMachineArn}'`,
                code: 'StateMachineAlreadyExists',
            }));
        });
    })

    describe('delete state machine', () => {
        it('should send an status code 200 when the state machine was deleted', async () => {
            expect.assertions(1);

            const req: CreateStateMachineInput = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };

            const createdStateMachine = await stepFunctions.createStateMachine(req).promise();
            const result = await stepFunctions.deleteStateMachine({stateMachineArn: createdStateMachine.stateMachineArn}).promise();

            expect(result).toBeDefined();
        });

        it('should send a status code 200 even if the state machine does not exists', async () => {
            expect.assertions(1);

            const result = await stepFunctions.deleteStateMachine({stateMachineArn: dummyStateMachineArn}).promise();

            expect(result).toBeDefined();
        });

        it('should throw if the state machine arn is invalid', async () => {
            expect.assertions(1);
            
            const stateMachineArn = 'badArn';
            await expect(stepFunctions.describeStateMachine({stateMachineArn}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                message: `Invalid Arn: '${stateMachineArn}'`,
                code: 'InvalidArn',
            }));
        });
    });
    
    describe('select one state machine', () => {
        it('should correctly select a state machine', async () => {
            expect.assertions(5);

            const req: CreateStateMachineInput = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };

            const createdStateMachine = await stepFunctions.createStateMachine(req).promise();
            const selectedStateMachine = await stepFunctions.describeStateMachine({stateMachineArn: createdStateMachine.stateMachineArn}).promise();

            expect(selectedStateMachine).toBeDefined();
            expect(selectedStateMachine.name).toBe(req.name);
            expect(selectedStateMachine.creationDate).toStrictEqual(createdStateMachine.creationDate);
            expect(JSON.parse(selectedStateMachine.definition)).toStrictEqual(JSON.parse(req.definition));
            expect(selectedStateMachine.roleArn).toBe(req.roleArn);
        });

        it('should throw if the state machine arn is invalid', async () => {
            expect.assertions(1);

            const stateMachineArn = 'badArn';
            await expect(stepFunctions.describeStateMachine({stateMachineArn}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                message: `Invalid Arn: '${stateMachineArn}'`,
                code: 'InvalidArn',
            }));

        });

        it('should throw if the state machine does not exists', async () => {
            expect.assertions(1);

            const stateMachineArn = 'arn:aws:states:us-east-1:123456789012:stateMachine:unexistingArn';
            await expect(stepFunctions.describeStateMachine({stateMachineArn}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                message: `State Machine Does Not Exist: '${stateMachineArn}'`,
                code: 'StateMachineDoesNotExist',
            }));
        });
    });

    describe('list state machines', () => {
        it('should correctly retrieve the list of state machines', async () => {
            expect.assertions(4);

            const req: CreateStateMachineInput = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };
    
            await stepFunctions.createStateMachine(req).promise();
            req.name = 'name2';
            await stepFunctions.createStateMachine(req).promise();
            
            const result = await stepFunctions.listStateMachines().promise();

            expect(result).toBeDefined();
            expect(result.nextToken).toBeNull();
            expect(result.stateMachines).toHaveLength(2);
            expect(result.stateMachines[0].name).toBe('name');
        });
        
        it('should correctly throw if the token is invalid', async () => {
            expect.assertions(1);

            const nextToken = 'badToken';
            await expect(stepFunctions.listStateMachines({nextToken}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                message: `Invalid Token: '${nextToken}'`,
                code: 'InvalidToken',
            }));
        });

        it('should throw if the maxResults is invalid', async () => {
            expect.assertions(1);

            const maxResults = -1;
            await expect(stepFunctions.listStateMachines({maxResults}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
            }));
        })
    });

    describe('update state machines', () => {
        it('should correctly update a state machine', async () => {
            expect.assertions(2);

            const req: CreateStateMachineInput = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };
            const createdStateMachine = await stepFunctions.createStateMachine(req).promise();
            const newDefinition = stateMachinesForTests.valid.validParallel;
            const updateDate = await stepFunctions.updateStateMachine({stateMachineArn: createdStateMachine.stateMachineArn,definition: newDefinition}).promise();
            const updatedStateMachine = await stepFunctions.describeStateMachine({stateMachineArn: createdStateMachine.stateMachineArn}).promise();

            expect(updateDate).toBeDefined();
            expect(JSON.parse(updatedStateMachine.definition)).toStrictEqual(JSON.parse(newDefinition));
        });

        it('should throw an invalid arn if the arn is invalid', async () => {
            expect.assertions(1);

            const createSMInput: CreateStateMachineInput = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };
            const createdStateMachine = await stepFunctions.createStateMachine(createSMInput).promise();

            const updateRequest = stepFunctions.updateStateMachine({stateMachineArn: createdStateMachine.stateMachineArn, roleArn: 'badArn'}).promise()
            await expect(updateRequest).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'InvalidArn',
            }));
        });

        it('should throw if the state machine does not exists', async () => {
            expect.assertions(1);

            await expect(stepFunctions.updateStateMachine({stateMachineArn: dummyStateMachineArn, roleArn: dummyRoleARN}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'StateMachineDoesNotExist',
            }));
        });

        it('should throw if the definition is incorrect', async () => {
            expect.assertions(1);

            const createSMInput: CreateStateMachineInput = {
                name: 'name',
                definition: stateMachinesForTests.valid.validPassState,
                roleArn: dummyRoleARN
            };
            const createdStateMachine = await stepFunctions.createStateMachine(createSMInput).promise();

            await expect(stepFunctions.updateStateMachine({stateMachineArn: createdStateMachine.stateMachineArn, definition: '{'}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST, 
                code: 'InvalidDefinition',
            }));
        });
    })
})