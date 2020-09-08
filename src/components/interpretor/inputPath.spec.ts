import { generateServiceTest } from "@Tests/testGenerator";
import * as ExecutionService from '@App/components/execution/executionService';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import * as TaskService from '@App/components/task/taskService';
import * as TestHelper from '@Tests/testHelper';
import { ExecutionStatus } from '../execution/execution.interfaces';

generateServiceTest('inputPath tests', (getUser) => {

    const startExecutionHelper = async (req: {stateMachineDef: string, input: string}) => {
        return TestHelper.createSMAndStartExecutionHelper({...req, userId: getUser().id})
    }

    describe('valid inputPath in simple pass state', () => {
        it('should work if the inputPath is correct', async () => {
            expect.assertions(4);

            const input = JSON.stringify({numbers: { val1: 3, val2: 4 }});
            const stateMachineDef = TestHelper.stateMachinesForTests.valid.validInputPathInPass;
            const {execution} = await startExecutionHelper({stateMachineDef, input});

            await InterpretorService.processNextTask();

            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});
            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();

            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.status).toBe(ExecutionStatus.succeeded);
            expect(finishedExecution.input).toStrictEqual(JSON.parse(input));
            expect(finishedExecution.output).toBe('{"val1":3,"val2":4}')
        });

        it('should fail if the inputPath does not exists in the input', async () => {
            expect.assertions(3);

            const input = JSON.stringify({});
            const stateMachineDef = TestHelper.stateMachinesForTests.valid.validInputPathInPass
            const {execution} = await startExecutionHelper({stateMachineDef, input});
            await InterpretorService.processNextTask();
            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});

            expect(finishedExecution.status).toBe(ExecutionStatus.failed);
            expect(finishedExecution.input).toStrictEqual(JSON.parse(input));
            expect(finishedExecution.output).toBeNull()
        });

    });

    describe('inputPath with the value $', () => {
        it.each([JSON.stringify({numbers: { val1: 3, val2: 4 }}), '{}'])('should do nothing if the inputPath is $ and the input is %p',  async (input: string) => {
            expect.assertions(3);

            const {execution} = await startExecutionHelper({stateMachineDef: TestHelper.stateMachinesForTests.valid.validInputPathDefault, input});
            await InterpretorService.processNextTask();
            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});
            expect(finishedExecution.status).toBe(ExecutionStatus.succeeded);
            expect(finishedExecution.input).toStrictEqual(JSON.parse(input));
            expect(finishedExecution.output).toBe(input)
        });

    })

    describe('state machine with multiple jsonPath in the inputPath', () => {
        it('should work', async () => {
            expect.assertions(3);

            const {execution} = await startExecutionHelper({
                stateMachineDef: TestHelper.stateMachinesForTests.valid.validInputPathMultiple,
                input: JSON.stringify({ "a": [1, 2, 3, 4] })
            });
            await InterpretorService.processNextTask();

            const finishedExecution = await ExecutionService.describeExecution({executionArn: execution.executionArn});
            const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();

            expect(numberOfRemainingTasks).toBe(0);
            expect(finishedExecution.status).toBe(ExecutionStatus.succeeded);
            expect(JSON.parse(finishedExecution.output)).toStrictEqual([1, 2])
        })
    })
});