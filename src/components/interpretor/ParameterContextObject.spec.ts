import { generateServiceTest } from "@Tests/testGenerator";
import * as TestHelper from '@Tests/testHelper';
import * as ExecutionService from '@App/components/execution/executionService';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import * as TaskService from '@App/components/task/taskService';
import { ExecutionStatus, ContextObject } from '../execution/execution.interfaces';
import { ISO8601_REGEX } from "@App/utils/validationHelper";

generateServiceTest({describeText: 'context object inside parameters', tests: (getUser) => {
    describe('state machine with single pass and use context object', () => {
        it('should correctly interpret the parameters', async () => {
            expect.assertions(19);
            const parsedInput = {name: 3, numbers: {five: 5, sept: 7}};
            const input = JSON.stringify(parsedInput);
            const executionName = 'executionName';
            const {execution, stateMachine} = await TestHelper.createSMAndStartExecutionHelper({
                stateMachineDef: TestHelper.stateMachinesForTests.valid.validPassParameters, 
                input, 
                executionName,
                userId: getUser().id
            });
            await InterpretorService.processNextTask();

            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();
            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});

            const output = JSON.parse(finishedExecution.output) as Record<string, unknown>;
            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.status).toBe(ExecutionStatus.succeeded);
            expect(output.CadContextObj).toBe('$$');
            expect(output.ContextObjectStateName).toBe('HelloWorld');
            expect(output.Numbers).toStrictEqual(parsedInput.numbers);
            expect(output.ContextObjectExecutionId).toBe(execution.executionArn);
            expect(output.Input).toStrictEqual(parsedInput);
            expect(output.ContextObjectStateMachineName).toBe(stateMachine.name);
            expect(output.ContextObjectSMId).toBe(stateMachine.arn);
            expect(output.ContextObjectExecutionName).toBe(executionName);

            const contextObject = output.ContextObj as ContextObject

            expect(contextObject.Execution.Id).toBe(execution.executionArn);
            expect(contextObject.Execution.Input).toStrictEqual(parsedInput);
            expect(contextObject.Execution.Name).toBe(executionName);
            expect(contextObject.Execution.StartTime).toMatch(ISO8601_REGEX);
            expect(contextObject.Execution.RoleArn).toBeDefined();
            expect(contextObject.State.EnteredTime).toMatch(ISO8601_REGEX);
            expect(contextObject.State.Name).toBe('HelloWorld');
            expect(contextObject.StateMachine.Id).toBe(stateMachine.arn);
            expect(contextObject.StateMachine.Name).toBe(stateMachine.name);
        });

        it('should delete the context object when the state machine is done', async () => {
            expect.assertions(1);

            const {execution} = await TestHelper.createSMAndStartExecutionHelper({
                stateMachineDef: TestHelper.stateMachinesForTests.valid.validPass,
                userId: getUser().id
            });
            await InterpretorService.processNextTask();
            const contextObject = await ExecutionService.retrieveExecutionContextObject(execution);

            expect(contextObject).toBeNull();
        })

        it('should fail the execution if the input does not contain a path in the parameters', async () => {
            expect.assertions(3);

            const {execution} = await TestHelper.createSMAndStartExecutionHelper({
                stateMachineDef: TestHelper.stateMachinesForTests.valid.validPassParameters, 
                input: '{}', 
                executionName: 'executionName',
                userId: getUser().id
            });

            await InterpretorService.processNextTask();
            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();
            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});

            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.status).toBe(ExecutionStatus.failed);
            expect(finishedExecution.output).toBeNull();
        })
    });

    describe('state machine with an incorrect parameter field', () => {
        it('should fail the execution', async () => {
            expect.assertions(3);

            const {execution} = await TestHelper.createSMAndStartExecutionHelper({
                stateMachineDef: TestHelper.stateMachinesForTests.valid.validPassIncorrectParameters,
                userId: getUser().id
            });
            await InterpretorService.processNextTask();

            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});
            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();

            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.status).toBe(ExecutionStatus.failed);
            expect(finishedExecution.output).toBeNull();
        });
    });

}})