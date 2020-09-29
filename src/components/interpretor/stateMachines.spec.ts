/* eslint-disable jest/no-conditional-expect */
/* eslint-disable jest/prefer-expect-assertions */
/* eslint-disable jest/no-if */
/* eslint-disable jest/consistent-test-it */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/valid-title */
import * as ExecutionService from '@App/components/execution/executionService';
import * as TaskService from '@App/components/task/taskService';
import * as TestHelper from '@Tests/testHelper';
import * as TimerService from '@App/components/timer/timerService'
import * as ActivityService from '@App/components/activity/activityService';
import * as Redis from '@App/modules/database/redis';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { generateServiceTest } from '@Tests/testGenerator';
import {readFileSync, readdirSync, statSync} from 'fs';
import {basename, dirname, join} from 'path';
import { isAnObject } from '@App/utils/objectUtils';
import { ActivitiyToCreateForTests, EventDurationExpectedForTests, TestStateMachine, TestStateMachineTestCase } from '@Tests/testHelper';
import { IUser } from '../user/user.interfaces';
import { ISO8601_REGEX } from '@App/utils/validationHelper';
import { WaitState } from '../stateMachines/stateMachine.interfaces';
import { HistoryEvent } from 'aws-sdk/clients/stepfunctions';
import { IActivity } from '../activity/activity.interfaces';


const getTests = (dirPath = 'tests'): TestStateMachine[] => {
    const fileNames = readdirSync(join(__dirname, dirPath));
    const toReturn: TestStateMachine[] = [];

    for(const fileName of fileNames) {
        if (statSync(join(__dirname, dirPath, fileName)).isDirectory()) {
            toReturn.push(...getTests(join(dirPath, fileName)));
        } else {
            const fileContent = JSON.parse(readFileSync(join(__dirname, dirPath, fileName), 'utf-8')) as TestStateMachine;
            fileContent.folderName = basename(dirname(join(__dirname, dirPath, fileName)));
            fileContent.stateMachineName = fileContent.stateMachineName ?? fileName.split('.')[0];
            toReturn.push(fileContent);
        }
    }

    return toReturn;
}

const generateTestCase = (testStateMachine: TestStateMachine, currentTest: TestStateMachineTestCase, getUser:  () => IUser) => {
    it(currentTest.describe, async () => {
        modifieTimestampInWaitTests(testStateMachine)
        const activities = await createActivities(currentTest.activitiesToCreate, getUser().id)
        const {execution} = await TestHelper.createSMAndStartExecutionHelper({
            userId: getUser().id,
            stateMachineDef: JSON.stringify(testStateMachine.definition), 
            input: JSON.stringify(currentTest.input),
            stateMachineName: currentTest.executionName,
            executionName: currentTest.executionName ?? 'executionName'
        });

        let finishedExecution = await ExecutionService.describeExecution(execution);
        await TestHelper.sleep(100);
        while (finishedExecution.status === ExecutionStatus.running) {
            await TestHelper.sleep(100);
            finishedExecution = await ExecutionService.describeExecution(execution);
            if (activities) {
                for(const activity of activities) {
                    const res = await TaskService.getActivityTask({activityArn: activity.activityArn});
                    console.log('res: ', res)
                    if (res.input) {
                        expect(JSON.parse(res.input)).toStrictEqual(activity.expectedInput);
                        await TaskService.sendTaskSuccess({output: activity.output, taskToken: res.taskToken});
                    }
                }
            }
        }
        const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();
        const numberOfDelayedTask = await TimerService.numberOfTimedTask();
        const numberOfWaitingTaskDone = await TimerService.numberOfWaitingTaskDone();
        const events = await ExecutionService.getExecutionHistory(execution);
        const contextObj = await Redis.jsongetAsync(Redis.getContextObjectKey(finishedExecution.executionArn));
        expect(contextObj).toBeNull();
        expect(numberOfRemainingTasks).toBe(0);
        expect(numberOfDelayedTask).toBe(0);
        expect(numberOfWaitingTaskDone).toBe(0);
        expect(finishedExecution.status).toBe(currentTest.expectedStateMachineStatus);
        expect(finishedExecution.output).toBe(isAnObject(currentTest.expectedOutput) ? JSON.stringify(currentTest.expectedOutput): currentTest.expectedOutput);
        expect(finishedExecution.stopDate).toBeDefined();
        expect(finishedExecution.input).toStrictEqual(currentTest.input)
        if (currentTest.events) {
            expectEventsToBeCorrect(currentTest.events, events, currentTest.eventsExpectedDuration)
        }
    });
}
const createActivities = async (activities: ActivitiyToCreateForTests[], userId: string): Promise<(ActivitiyToCreateForTests & {activityArn: string})[]> => {
    if (!activities) return;

    const toReturn = [];
    for (const activity of activities) {
        toReturn.push({...activity, ...await ActivityService.createActivity(userId, activity.name)});
    }

    return toReturn;
}

const expectEventsToBeCorrect = (received: HistoryEvent[], expected: HistoryEvent[], expectedDurations?: EventDurationExpectedForTests[]) => {
    for (let i = 0; i < expected.length; i++) {
        expect(received[i].timestamp).toMatch(ISO8601_REGEX);
        const expectedDuration = expectedDurations?.find(x => x.eventId === received[i].id);
        if (expectedDuration){
            const previousEventTime = expected.find(x => x.id === received[i].previousEventId).timestamp;
            const currentEventTime = new Date(expected[i].timestamp);
            const previousDate = new Date(previousEventTime);
            const seconds = (currentEventTime.getTime() - previousDate.getTime()) / 1000;
            expect(Math.round(seconds)).toBe(expectedDuration.expectedDurationInSeconds);
        }
    }
    for (let i = 0; i < expected.length; i++) {
        delete expected[i].timestamp;
        delete received[i].timestamp;
    }

    expect(received).toStrictEqual(expected);
}

const modifieTimestampInWaitTests = (stateMachineTested: TestStateMachine) => {
    if (stateMachineTested.stateMachineName === 'wait-timestamp') {
        const time = new Date();
        time.setSeconds(time.getSeconds() + 1);
        (stateMachineTested.definition.States.Hello as WaitState).Timestamp = time.toISOString()
    }

    const test = stateMachineTested.tests.find(x => x.executionName === 'timestampPathSuccess')
    if (test) {
        const time = new Date();
        time.setSeconds(time.getSeconds() + 2);
        test.input = {timestamp: time.toISOString()}
        test.expectedOutput = JSON.stringify(test.input)
        test.events[0].executionStartedEventDetails.input = JSON.stringify(test.input);
        test.events[1].stateEnteredEventDetails.input = JSON.stringify(test.input);
        test.events[2].stateExitedEventDetails.output = JSON.stringify(test.input);
        test.events[3].executionSucceededEventDetails.output = JSON.stringify(test.input);
    }
}

const generateStateMachinesTests = (req?: {stateMachineName?: string, executionName?: string, folderName?: string}) => {
    generateServiceTest({ describeText: 'simple state machine with only a pass state',options: {startInterpretor: true, mockDate: false}, tests: (getUser) => {
        let tests = getTests();
        if (req?.folderName) {
            tests = tests.filter(x => x.folderName === req.folderName);
        }
        for(const stateMachine of tests) {
            if (req?.stateMachineName && req?.stateMachineName !== stateMachine.stateMachineName) {
                continue;
            }
            describe(stateMachine.describe, () => {
                for (const test of stateMachine.tests) {
                    if (req?.executionName && req?.executionName !== test.executionName) {
                        continue;
                    }
                    generateTestCase(stateMachine, test, getUser);
                }
            })
        }
    }});
}

generateStateMachinesTests({folderName: 'task'});