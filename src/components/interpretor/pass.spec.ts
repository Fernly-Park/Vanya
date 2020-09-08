import * as ExecutionService from '@App/components/execution/executionService';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import * as UserService from '@App/components/user/userService';
import * as TaskService from '@App/components/task/taskService';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import { IUser } from '../user/user.interfaces';
import * as TestHelper from '@Tests/testHelper';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { generateServiceTest } from '@Tests/testGenerator';

generateServiceTest('simple state machine with only a pass state', (getUser) => {

    const startExecution = async (req: {stateMachineDef: string, input?: string}) => {
        return await TestHelper.createSMAndStartExecutionHelper({...req, userId: getUser().id});
    }

    describe('simple pass state', () => {
        it.each(['{}', JSON.stringify({test: 'tea'}), 
                 JSON.stringify([]), JSON.stringify([1, 2])])('should correctly transfer the input %p to the output', async (input: string) => {
            expect.assertions(5);

            const {execution} = await startExecution({stateMachineDef: TestHelper.stateMachinesForTests.valid.validPass, input});
            await InterpretorService.processNextTask();
            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});
            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();

            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.status).toBe(ExecutionStatus.succeeded);
            expect(finishedExecution.output).toBe(input);
            expect(finishedExecution.stopDate).toBeDefined();
            expect(finishedExecution.input).toStrictEqual(JSON.parse(input));
        });
    });

    describe('simply a pass state with a Result param', () => {
        it('should use the result as the output', async () => {
            expect.assertions(3);
            
            const {execution} = await startExecution({stateMachineDef: TestHelper.stateMachinesForTests.valid.validPassWithResult})
            await InterpretorService.processNextTask();
            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});
            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();
    
            expect(finishedExecution.status).toBe(ExecutionStatus.succeeded);
            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.output).toBe('Hello World!');
        });
    });

    
    describe('state machine with two pass states', () => {
        it('should work with two pass states', async () => {
            expect.assertions(5);

            const input = JSON.stringify({tea: 'tea'});
            const {execution} = await startExecution({stateMachineDef: TestHelper.stateMachinesForTests.valid.validPassTwoStates, input });
            await InterpretorService.processNextTask();
            await InterpretorService.processNextTask();
            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});
            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();

            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.status).toBe(ExecutionStatus.succeeded);
            expect(finishedExecution.output).toBe(input);
            expect(finishedExecution.stopDate).toBeDefined();
            expect(finishedExecution.input).toStrictEqual(JSON.parse(input));
        });
    });

});