import AWS from 'aws-sdk';
import initApp from '@App/app';
import http from 'http';
import { stateMachinesForTests, dummyRoleARN, dummyStateMachineArn, setupForTestAgainstServer, dummyExecutionArn } from '@Tests/testHelper';
import { HttpStatusCode } from '@App/utils/httpStatusCode';
import { ExecutionStatus } from './execution.interfaces';

describe('executions tests', () => {
    let server: http.Server;
    let stepFunctions: AWS.StepFunctions;

    beforeAll(async done => {
        const app = await initApp()
        server = http.createServer(app);
        server.listen(3000, 'localhost', 511, done);
    });

    beforeEach(async () => {
        stepFunctions = await setupForTestAgainstServer()
    });

    afterAll(done => {
        server.close(done);
    });

    const createSMAndStartExecution = async (req?: {stateMachineName?: string, executionName?: string, input?: string}) => {
        const sm = await stepFunctions.createStateMachine({
            definition: stateMachinesForTests.valid.validPassWithResult, 
            roleArn: dummyRoleARN, 
            name: req?.stateMachineName ?? 'smName'}).promise();
        return await stepFunctions.startExecution({
            stateMachineArn: sm.stateMachineArn, 
            name: req?.executionName,
            input: req?.input}).promise();
    }

    describe('start execution', () => {

        it('should correctly create an execution', async () => {
            expect.assertions(3);
            
            const result = await createSMAndStartExecution();

            expect(result).toBeDefined();
            expect(result.executionArn).toBeDefined();
            expect(result.startDate).toBeDefined();
        });

        it('should throw if an execution already exists', async () => {
            expect.assertions(1);

            const name = 'executionName';
            const input = '{}';
            await createSMAndStartExecution({executionName: name, input});
            const newInput = JSON.stringify({tea: 'tea'})

            await expect(createSMAndStartExecution({executionName: name, input: newInput})).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'ExecutionAlreadyExists',
            }));
        });

        it('should throw if the state machine arn does not exists', async () => {
            expect.assertions(1);

            await expect(stepFunctions.startExecution({stateMachineArn: dummyStateMachineArn}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'StateMachineDoesNotExist',
            }));
        });

        it('should throw if the state machine arn is badly formed', async () => {
            expect.assertions(1);

            await expect(stepFunctions.startExecution({stateMachineArn: 'badArn'}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'InvalidArn',
            }));
        });

        it('should throw if the name is invalid', async () => {
            expect.assertions(1);
            await expect(createSMAndStartExecution({executionName: 'ba* d n / ame'})).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'InvalidName',
            }));
        });

        it('should throw if the input is invalid', async () => {
            expect.assertions(1);

            await expect(createSMAndStartExecution({input: '{'})).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'InvalidExecutionInput',
            }));
        });
    });

    describe('select execution', () => {

        it('shoud correctly retrieve an execution', async () => {
            expect.assertions(7);

            const input = '{}'
            const executionName = 'executionName';
            const result = await createSMAndStartExecution({input, executionName});
            const retrievedExecution = await stepFunctions.describeExecution({executionArn: result.executionArn}).promise();

            expect(retrievedExecution).toBeDefined();
            expect(retrievedExecution.executionArn).toBe(result.executionArn);
            expect(retrievedExecution.input).toBe(input);
            expect(retrievedExecution.name).toBe(executionName);
            expect(retrievedExecution.startDate).toStrictEqual(result.startDate);
            expect(retrievedExecution.stateMachineArn).toBeDefined();
            expect(retrievedExecution.status).toBe(ExecutionStatus.running);
        });

        it('should throw if the execution does not exists', async () => {
            expect.assertions(1);

            await expect(stepFunctions.describeExecution({executionArn: dummyExecutionArn}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'ExecutionDoesNotExist',
            }));
        });

        it('should throw if the execution arn is invalid', async () => {
            expect.assertions(1);

            await expect(stepFunctions.describeExecution({executionArn: 'badArn'}).promise()).rejects.toThrow(expect.objectContaining({
                statusCode: HttpStatusCode.BAD_REQUEST,
                code: 'InvalidArn',
            }));
        });

    });
});