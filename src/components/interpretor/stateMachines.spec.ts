/* eslint-disable jest/prefer-expect-assertions */
/* eslint-disable jest/no-if */
/* eslint-disable jest/consistent-test-it */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/valid-title */
import * as ExecutionService from '@App/components/execution/executionService';
import * as TaskService from '@App/components/task/taskService';
import * as TestHelper from '@Tests/testHelper';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { generateServiceTest } from '@Tests/testGenerator';
import {readFileSync, readdirSync} from 'fs';
import {join} from 'path';
import { IStateMachine, StateMachineStatus } from '../stateMachines/stateMachine.interfaces';
import { isAnObject } from '@App/utils/objectUtils';
import { HistoryEvent } from 'aws-sdk/clients/swf';

type TestStateMachineTestCase = {
    input: Record<string, unknown>,
    expectedStateMachineStatus: StateMachineStatus,
    expectedOutput: string,
    describe: string,
    executionName?: string,
    events?: HistoryEvent[]
}
type TestStateMachine = {
    definition: IStateMachine,
    describe: string,
    tests: TestStateMachineTestCase[],
    stateMachineName: string
}

const getTests = (): TestStateMachine[] => {
    const fileNames = readdirSync(join(__dirname, 'tests'));
    const toReturn: TestStateMachine[] = [];

    for(const fileName of fileNames) {
        const fileContent = JSON.parse(readFileSync(join(__dirname, 'tests', fileName), 'utf-8')) as TestStateMachine;
        fileContent.stateMachineName = fileContent.stateMachineName ?? fileName.split('.')[0];
        toReturn.push(fileContent);
    }

    return toReturn;
}
const generateStateMachinesTests = (req?: {stateMachineName?: string, executionName?: string}) => {
    generateServiceTest({ 
        describeText: 'simple state machine with only a pass state',
        options: {startInterpretor: true, mockDate: true},
        tests: (getUser) => {
            const generateTestCase = (testStateMachine: TestStateMachine, currentTest: TestStateMachineTestCase) => {
                it(currentTest.describe, async () => {
                    expect.assertions(currentTest.events ? 6 : 5);

                    const {execution} = await TestHelper.createSMAndStartExecutionHelper({
                        userId: getUser().id,
                        stateMachineDef: JSON.stringify(testStateMachine.definition), 
                        input: JSON.stringify(currentTest.input),
                        stateMachineName: currentTest.executionName,
                        executionName: currentTest.executionName ?? 'executionName'
                    });
            
                    let finishedExecution = await ExecutionService.describeExecution(execution);
                    while (finishedExecution.status === ExecutionStatus.running) {
                        await TestHelper.sleep(10);
                        finishedExecution = await ExecutionService.describeExecution(execution);
                    }
                    const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();
                    const events = await ExecutionService.getExecutionHistory(execution);

                    expect(numberOfRemainingTasks).toBe(0);
                    expect(finishedExecution.status).toBe(currentTest.expectedStateMachineStatus);
                    expect(finishedExecution.output).toBe(isAnObject(currentTest.expectedOutput) ? JSON.stringify(currentTest.expectedOutput): currentTest.expectedOutput);
                    expect(finishedExecution.stopDate).toBeDefined();
                    expect(finishedExecution.input).toStrictEqual(currentTest.input)
                    if (currentTest.events) {
                        // eslint-disable-next-line jest/no-conditional-expect
                        expect(events).toStrictEqual(currentTest.events);
                    }

                });
            }
        
            for(const stateMachine of getTests()) {
                if (req?.stateMachineName && req?.stateMachineName !== stateMachine.stateMachineName) {
                    continue;
                }
                describe(stateMachine.describe, () => {
                    for (const test of stateMachine.tests) {
                        if (req?.executionName && req?.executionName !== test.executionName) {
                            continue;
                        }
                        generateTestCase(stateMachine, test);
                    }
                })
            }
    
        }
    });
}

generateStateMachinesTests();