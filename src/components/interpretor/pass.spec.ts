/* eslint-disable jest/consistent-test-it */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/valid-title */
import * as ExecutionService from '@App/components/execution/executionService';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import * as TaskService from '@App/components/task/taskService';
import * as TestHelper from '@Tests/testHelper';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { generateServiceTest } from '@Tests/testGenerator';
import {readFileSync, readdirSync} from 'fs';
import {join} from 'path';
import { IStateMachine, StateMachineStatus } from '../stateMachines/stateMachine.interfaces';
import { isAnObject } from '@App/utils/objectUtils';
import * as Redis from "@App/modules/database/redis";

type TestStateMachineTestCase = {
    input: Record<string, unknown>,
    expectedStateMachineStatus: StateMachineStatus,
    expectedOutput: string,
    describe: string,
    name?: string
}
type TestStateMachine = {
    definition: IStateMachine,
    describe: string,
    tests: TestStateMachineTestCase[],
    name: string
}

const getTests = (): TestStateMachine[] => {
    const fileNames = readdirSync(join(__dirname, 'tests'));
    const toReturn: TestStateMachine[] = [];

    for(const fileName of fileNames) {
        const fileContent = JSON.parse(readFileSync(join(__dirname, 'tests', fileName), 'utf-8')) as TestStateMachine;
        fileContent.name = fileContent.name ?? fileName.split('.')[0];
        toReturn.push(fileContent);
    }

    return toReturn;
}
const generateStateMachinesTests = (req?: {stateMachineName?: string, testName?: string}) => {
    generateServiceTest('simple state machine with only a pass state', (getUser) => {

        beforeEach( () => {
            void InterpretorService.startInterpretor().then();
            
        });
        afterEach(() => {
            InterpretorService.stopInterpreter();
        })
    
        const startExecution = async (req: {stateMachineDef: string, input?: string}) => {
            return await TestHelper.createSMAndStartExecutionHelper({...req, userId: getUser().id});
        }
    
        const generateTestCase = (testStateMachine: TestStateMachine, currentTest: TestStateMachineTestCase) => {
            it(currentTest.describe, async () => {
                expect.assertions(5);
        
                const {execution} = await startExecution({
                    stateMachineDef: JSON.stringify(testStateMachine.definition), 
                    input: JSON.stringify(currentTest.input)
                });
        
                let finishedExecution = await ExecutionService.describeExecution(execution);
                while (finishedExecution.status === ExecutionStatus.running) {
                    await TestHelper.sleep(10);
                    finishedExecution = await ExecutionService.describeExecution(execution);
                }
                const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();
                expect(numberOfRemainingTasks).toBe(0);
                expect(finishedExecution.status).toBe(currentTest.expectedStateMachineStatus);
                expect(finishedExecution.output).toBe(isAnObject(currentTest.expectedOutput) ? JSON.stringify(currentTest.expectedOutput): currentTest.expectedOutput);
                expect(finishedExecution.stopDate).toBeDefined();
                expect(finishedExecution.input).toStrictEqual(currentTest.input)
            });
        }
    
        for(const stateMachine of getTests()) {
            if (req?.stateMachineName && req?.stateMachineName !== stateMachine.name) {
                continue;
            }
            describe(stateMachine.describe, () => {
                for (const test of stateMachine.tests) {
                    if (req?.testName && req?.testName !== test.name) {
                        continue;
                    }
                    generateTestCase(stateMachine, test);
                }
            })
        }
    
    });
}

generateStateMachinesTests();