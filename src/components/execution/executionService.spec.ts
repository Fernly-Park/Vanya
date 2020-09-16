import * as ExecutionService from '@App/components/execution/executionService';
import * as ExecutionDAL from '@App/components/execution/executionDAL';
import db from '@App/modules/database/db';
import * as Redis from '@App/modules/database/redis';
import * as TestHelper from '@Tests/testHelper';
import { ExecutionStatus } from '@App/components/execution/execution.interfaces';
import { UserDoesNotExistsError } from '@App/errors/customErrors';
import { InvalidExecutionInputError, InvalidNameError, InvalidArnError, StateMachineDoesNotExistsError, ExecutionAlreadyExistsError, ExecutionDoesNotExistError } from '@App/errors/AWSErrors';
import { generateServiceTest } from '@Tests/testGenerator';

generateServiceTest({describeText: 'execution', tests: (getUser) => {

    const createSMAndStartExecutionHelper = async (req?: { 
        stateMachineName?: string,
        userId?: string,
        input?: string,
        executionName?: string
    }) => {
        return await TestHelper.createSMAndStartExecutionHelper({...req, userId: req?.userId ?? getUser().id});
    }

    describe('start execution', () => {
        it('should correctly start an execution', async () => {
            expect.assertions(12);

            const input = '{}';
            const name = 'executionName';

            const {execution: execution, stateMachine} = await createSMAndStartExecutionHelper({input, executionName: name});
            
            expect(execution).toBeDefined();
            expect(execution.startDate).toBeDefined();
            expect(execution.executionArn).toBeDefined();
            expect(await ExecutionDAL.countExecutions(db)).toBe(1);
            const retrievedExecution = await ExecutionDAL.selectExecutionByArn(db, execution.executionArn);

            expect(retrievedExecution.executionArn).toBe(execution.executionArn);
            expect(retrievedExecution.input).toStrictEqual(JSON.parse(input));
            expect(retrievedExecution.name).toBe(name);
            expect(retrievedExecution.output).toBeNull();
            expect(retrievedExecution.stateMachineArn).toBe(stateMachine.arn);
            expect(retrievedExecution.status).toBe(ExecutionStatus.running);
            expect(retrievedExecution.stopDate).toBeNull();
            expect(retrievedExecution.startDate).toStrictEqual(execution.startDate);
        });

        it('should correctly create an event when starting an execution', async () => {
            expect.assertions(6);

            const {execution} = await createSMAndStartExecutionHelper();
            const result = await ExecutionService.getExecutionHistory(execution);

            expect(result).toHaveLength(1);
            expect(result[0].type).toBe('ExecutionStarted');
            expect(result[0].id).toBe(1);
            expect(result[0].previousEventId).toBe(0);
            expect(result[0].timestamp).toBeDefined();
            expect(result[0].executionStartedEventDetails.input).toBe('{}');
        });

        it.each([JSON.stringify([]), JSON.stringify([1, 2]), JSON.stringify([1, 'a'])])('should start an execution with %p as input', async (input: string) => {
            expect.assertions(1);

            const {execution: execution} = await createSMAndStartExecutionHelper({input});
            const retrievedExecution = await ExecutionService.describeExecution(execution);

            expect(retrievedExecution.input).toStrictEqual(JSON.parse(input));
        });

        it('should start an execution without a name and input', async () => {
            expect.assertions(1);

            const {execution: execution} = await createSMAndStartExecutionHelper();

            expect(execution).toBeDefined();

        });

        it('should do nothing if an execution with the same name and input exists and is running', async () => {
            expect.assertions(2);

            const executionName = 'name';
            const executionInput = JSON.stringify({tea: 'tea'});
            const {execution: firstExecution} = await createSMAndStartExecutionHelper({executionName, input: executionInput});
            const {execution: secondExecution} = await createSMAndStartExecutionHelper({executionName, input: executionInput});

            const numberOfExecutions = await ExecutionDAL.countExecutions(db);

            expect(secondExecution).toStrictEqual(firstExecution);
            expect(numberOfExecutions).toBe(1);
        });

        it('should correctly create a context object', async () => {
            expect.assertions(6);

            const executionName = 'name';
            const input = '{}';
            const {execution: execution, stateMachine} = await createSMAndStartExecutionHelper({executionName, input});
            const contextObject = await ExecutionService.retrieveExecutionContextObject({executionArn: execution.executionArn});

            expect(contextObject.Execution.Id).toBe(execution.executionArn);
            expect(contextObject.Execution.Input).toStrictEqual(JSON.parse(input));
            expect(contextObject.Execution.Name).toBe(executionName);
            expect(new Date(contextObject.Execution.StartTime)).toStrictEqual(execution.startDate);
            expect(contextObject.StateMachine.Id).toBe(stateMachine.arn);
            expect(contextObject.StateMachine.Name).toBe(stateMachine.name);
        })

        it('should throw if an execution with the same name and a different input exists', async () => {
            expect.assertions(2);

            const executionName = 'name';
            const executionInput = JSON.stringify({tea: 'tea'});
            await createSMAndStartExecutionHelper({executionName, input: executionInput});
            await expect(createSMAndStartExecutionHelper({executionName})).rejects.toThrow(ExecutionAlreadyExistsError);
            const numberOfExecutions = await ExecutionDAL.countExecutions(db);
            expect(numberOfExecutions).toBe(1);
        });

        it('should throw if an execution with the same name and same input exists but is not running', async () => {
            expect.assertions(2);

            const executionName = 'name';
            const executionInput = JSON.stringify({tea: 'tea'});
            const {execution: execution} = await createSMAndStartExecutionHelper({executionName, input: executionInput});
            await ExecutionDAL.updateExecutionStatus(db, {executionArn: execution.executionArn, newStatus: ExecutionStatus.succeeded, output: {}});
            await expect(createSMAndStartExecutionHelper({executionName, input: executionInput})).rejects.toThrow(ExecutionAlreadyExistsError);
            const numberOfExecutions = await ExecutionDAL.countExecutions(db);
            expect(numberOfExecutions).toBe(1);
        })

        it('should not create if the user id is incorrect', async () => {
            expect.assertions(1);

            await expect(createSMAndStartExecutionHelper({userId: TestHelper.dummyId})).rejects.toThrow(UserDoesNotExistsError)
        });

        it('should throw if the input is not a valid json', async () => {
            expect.assertions(1);

            await expect(createSMAndStartExecutionHelper({input: '{'})).rejects.toThrow(InvalidExecutionInputError);
        });

        it.each(TestHelper.badResourceNameCases)('should fail if the execution name is %p', async (executionName: string) => {
            expect.assertions(1);

            await expect(createSMAndStartExecutionHelper({executionName})).rejects.toThrow(InvalidNameError);
        });

        it('should throw if the state machine arn is invalid', async () => {
            expect.assertions(1);

            await expect(ExecutionService.startExecution(getUser().id, {stateMachineArn: 'badArn'})).rejects.toThrow(InvalidArnError);
        });

        it('should throw if the state machine arn does not exists', async () => {
            expect.assertions(1);

            await expect(ExecutionService.startExecution(getUser().id, {stateMachineArn: TestHelper.dummyStateMachineArn})).rejects.toThrow(StateMachineDoesNotExistsError);
        })
    });

    
    describe('select execution by arn', () => {

        it('should correctly retrieve an execution', async () => {
            expect.assertions(5);

            const input = {tea: 'tea'};
            const executionName = 'executionName';
            const result = await createSMAndStartExecutionHelper({input: JSON.stringify(input), executionName});
            const retrievedExecution = await ExecutionService.describeExecution({executionArn: result.execution.executionArn});

            expect(retrievedExecution).toBeDefined();
            expect(retrievedExecution.executionArn).toBe(result.execution.executionArn);
            expect(retrievedExecution.input).toStrictEqual(input)
            expect(retrievedExecution.name).toBe(executionName);
            expect(retrievedExecution.status).toBe(ExecutionStatus.running);
        });

        it('should throw if the execution does not exists', async () => {
            expect.assertions(1);

            await expect(ExecutionService.describeExecution({executionArn: TestHelper.dummyExecutionArn})).rejects.toThrow(ExecutionDoesNotExistError);
        });

        it('should throw if the arn is invalid', async () => {
            expect.assertions(1);

            await expect(ExecutionService.describeExecution({executionArn: 'badArn'})).rejects.toThrow(InvalidArnError);
        });
    });

    describe('end execution', () => {
        it('should correctly delete the execution context', async () => {
            expect.assertions(2);

            const {execution} = await createSMAndStartExecutionHelper();

            const beforeEndingExecution = await ExecutionService.retrieveExecutionContextObject({executionArn: execution.executionArn});
            await ExecutionService.endExecution({status: ExecutionStatus.succeeded, executionArn: execution.executionArn});
            const afterEndingExecution = await ExecutionService.retrieveExecutionContextObject(execution);

            expect(beforeEndingExecution).toBeDefined();
            expect(afterEndingExecution).toBeNull();
        });

        it('should correctly delete the events from redis once the execution is finished', async () => {
            expect.assertions(2);

            const {execution} = await createSMAndStartExecutionHelper();

            const key = Redis.getExecutionEventKey(execution.executionArn);
            const eventsFromRedisBefore = await Redis.lrangeAsync(key, 0, -1);
            await ExecutionService.endExecution({status: ExecutionStatus.succeeded, executionArn: execution.executionArn});
            const eventsFromRedisAfter = await Redis.lrangeAsync(key, 0, -1);

            expect(eventsFromRedisBefore).toHaveLength(1);
            expect(eventsFromRedisAfter).toHaveLength(0);
        });
    });
}})
