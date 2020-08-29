import * as Redis from '@App/modules/database/redis';
import * as UserService from '@App/components/user/userService';
import * as ExecutionService from '@App/components/execution/executionService';
import * as ExecutionDAL from '@App/components/execution/executionDAL';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import db from '@App/modules/database/db';

import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests, emptyExecutionTable } from '@Tests/fixtures/db';
import { stateMachinesForTests, dummyRoleARN, dummyId, badResourceNameCases, dummyStateMachineArn } from '@Tests/testHelper';
import { ExecutionStatus } from '@App/components/execution/execution.interfaces';
import { UserDoesNotExistsError } from '@App/errors/customErrors';
import { InvalidExecutionInputError, InvalidNameError, InvalidArnError, StateMachineDoesNotExistsError } from '@App/errors/AWSErrors';

describe('execution', () => {
    let user: IUser;

    beforeAll(async () => {
        await setupDatabaseForTests();
        user = await UserService.createUser('sub', 'tmp@gmail.com');
    });

    beforeEach(async () => {
        await Redis.flushallAsync();
        await emptyExecutionTable();
    });
    afterAll(async () => {
        await Redis.quitAsync();
    });

    const createStateMachineHelper = async (name?: string) => {
        return await StateMachineService.createStateMachine(user.id, {
            name: name ?? 'SMname',
            definition: stateMachinesForTests.valid.validHelloWorld,
            roleArn: dummyRoleARN
        });
    }

    const createSMAndStartExecutionHelper = async (req?: {
        stateMachineName?: string,
        userId?: string,
        input?: string,
        executionName?: string
    }) => {
        const stateMachine = await createStateMachineHelper(req?.stateMachineName);
        return {
            startExecutionResult : await ExecutionService.startExecution(req?.userId ?? user.id, {
                stateMachineArn: stateMachine.arn,
                input: req?.input,
                name: req?.executionName
            }),
            stateMachine: stateMachine
        };
    };

    describe('start execution', () => {
        it('should correctly start an execution', async () => {
            expect.assertions(11);

            const input = '{}';
            const name = 'executionName';

            const {startExecutionResult: execution, stateMachine} = await createSMAndStartExecutionHelper({input, executionName: name});
            
            expect(execution).toBeDefined();
            expect(execution.startDate).toBeDefined();
            expect(execution.executionArn).toBeDefined();

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

        it('should start an execution without a name and input', async () => {
            expect.assertions(1);

            const {startExecutionResult: execution} = await createSMAndStartExecutionHelper();

            expect(execution).toBeDefined();

        })

        it('should not create if the user id is incorrect', async () => {
            expect.assertions(1);

            await expect(createSMAndStartExecutionHelper({userId: dummyId})).rejects.toThrow(UserDoesNotExistsError)
        });

        it('should throw if the input is not a valid json', async () => {
            expect.assertions(1);

            await expect(createSMAndStartExecutionHelper({input: '{'})).rejects.toThrow(InvalidExecutionInputError);
        });

        it.each(badResourceNameCases)('should fail if the execution name is %p', async (executionName: string) => {
            expect.assertions(1);

            await expect(createSMAndStartExecutionHelper({executionName})).rejects.toThrow(InvalidNameError);
        });

        it('should throw if the state machine arn is invalid', async () => {
            expect.assertions(1);

            await expect(ExecutionService.startExecution(user.id, {stateMachineArn: 'badArn'})).rejects.toThrow(InvalidArnError);
        });

        it('should throw if the state machine arn does not exists', async () => {
            expect.assertions(1);

            await expect(ExecutionService.startExecution(user.id, {stateMachineArn: dummyStateMachineArn})).rejects.toThrow(StateMachineDoesNotExistsError);
        })
    });
});