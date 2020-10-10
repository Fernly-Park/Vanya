/* eslint-disable jest/no-conditional-expect */
/* eslint-disable jest/prefer-expect-assertions */
/* eslint-disable jest/no-if */
/* eslint-disable jest/consistent-test-it */
/* eslint-disable jest/require-top-level-describe */
/* eslint-disable jest/valid-title */
import * as TestHelper from '@Tests/testHelper';
import * as Redis from '@App/modules/database/redis';
import { ExecutionStatus } from '../execution/execution.interfaces';
import { generateServiceTest } from '@Tests/testGenerator';
import {readFileSync, readdirSync, statSync} from 'fs';
import {basename, dirname, join} from 'path';
import { ActivitiyToCreateForTests, EventDurationExpectedForTests, TestStateMachine, TestStateMachineTestCase } from '@Tests/testHelper';
import { IUser } from '../user/user.interfaces';
import { ISO8601_REGEX } from '@App/utils/validationHelper';
import { WaitState } from '../stateMachines/stateMachine.interfaces';
import { HistoryEvent } from 'aws-sdk/clients/stepfunctions';
import { ExecutionService } from '../execution';
import { TaskService } from '../task';
import { TimerService } from '../timer';
import { ActivityService } from '../activity';
import { clearInterval, setInterval } from 'timers';

jest.setTimeout(10000)

const getTests = (dirPath = 'tests'): TestStateMachine[] => {
    const fileNames = readdirSync(join(__dirname, dirPath));
    const toReturn: TestStateMachine[] = [];

    for (const fileName of fileNames) {
        if (statSync(join(__dirname, dirPath, fileName)).isDirectory()) {
            toReturn.push(...getTests(join(dirPath, fileName)));
        } else {
            const fileContent = JSON.parse(readFileSync(join(__dirname, dirPath, fileName), 'utf-8')) as TestStateMachine;
            fileContent.folderName = basename(dirname(join(__dirname, dirPath, fileName)));
            fileContent.stateMachineName = fileContent.stateMachineName ?? fileName.split('.')[0];
            for (let i = 0; i < fileContent.tests.length; i++) {
                fileContent.tests[i].executionName = fileContent.tests[i].executionName ?? fileContent.stateMachineName + i.toString();
            }
            toReturn.push(fileContent);
        }
    }

    return toReturn;
}

const generateTestCase = (testStateMachine: TestStateMachine, currentTest: TestStateMachineTestCase, getUser:  () => IUser) => {
    it(currentTest.executionName + ' - ' + currentTest.describe, async () => {
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
        while (finishedExecution.status === ExecutionStatus.running) {
            finishedExecution = await ExecutionService.describeExecution(execution);
            await manageWorkers(activities);
        }
        const numberOfRemainingTasks = await TaskService.numberOfGeneralTask();
        const numberOfDelayedTask = await TimerService.numberOfTimedTask();
        const events = await ExecutionService.getExecutionHistory(execution);
        const contextObj = await Redis.jsongetAsync(Redis.getContextObjectKey(finishedExecution.executionArn));
        expect(contextObj).toBeNull();
        expect(numberOfRemainingTasks).toBe(0);
        expect(numberOfDelayedTask).toBe(0);
        expect(finishedExecution.status).toBe(currentTest.expectedStateMachineStatus);
        if (typeof currentTest.expectedOutput === 'object') {
            expect(JSON.parse(finishedExecution.output)).toStrictEqual(currentTest.expectedOutput);
        } else {
            expect(finishedExecution.output).toBe(currentTest.expectedOutput);
        }
        expect(finishedExecution.stopDate).toBeDefined();
        expect(finishedExecution.input).toStrictEqual(currentTest.input)
        if (currentTest.events) {
            expectEventsToBeCorrect(currentTest.events, events, currentTest.eventsExpectedDuration)
        }
    });
}

const manageWorkers = async (activities: (ActivitiyToCreateForTests & {activityArn: string})[]) => {
    if (!activities) {
        return;
    }
    for(const activity of activities) {
        activity.waitBeforeGetActivityTaskSeconds ? await TestHelper.sleep(activity.waitBeforeGetActivityTaskSeconds * 1000) : false
        const res = await TaskService.getActivityTask({activityArn: activity.activityArn, workerName: activity.workerName});
        if (res.input) {
            const interval = activity.heartbeatIntervalSeconds 
            ? setInterval(() => {
                // eslint-disable-next-line jest/valid-expect-in-promise
                void TaskService.sendTaskHeartbeat({taskToken: res.taskToken}).then().catch((err) => {
                    console.log(err);
                    return clearInterval(interval);
                })
            }, activity.heartbeatIntervalSeconds * 1000)
            : undefined;
            expect(JSON.parse(res.input)).toStrictEqual(activity.expectedInput);
            if (activity.workDurationSeconds) {
                await TestHelper.sleep(activity.workDurationSeconds * 1000)
            }
            try {
                interval ? clearInterval(interval) : false
                if (activity.fail) {
                    await TaskService.sendTaskFailure({taskToken: res.taskToken, cause: activity.fail.cause, error: activity.fail.error});
                } else {
                    await TaskService.sendTaskSuccess({output: activity.output, taskToken: res.taskToken});
                }
            // eslint-disable-next-line no-empty
            } catch (err){
                console.log('error sending : ', err)
            }
        }
    }
}

const createActivities = async (activities: ActivitiyToCreateForTests[], userId: string): Promise<(ActivitiyToCreateForTests & {activityArn: string})[]> => {
    if (!activities) return;

    const toReturn = [];
    for (const activity of activities) {
        toReturn.push({...activity, output: JSON.stringify(activity.output),...await ActivityService.createActivity(userId, activity.name)});
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
    generateServiceTest({ describeText: 'state machine executions',options: {startInterpretor: true, mockDate: false}, tests: (getUser) => {
        let tests = getTests();
        if (req?.folderName) {
            tests = tests.filter(x => x.folderName === req.folderName);
        }
        for(const stateMachine of tests) {
            if (req?.stateMachineName && req?.stateMachineName !== stateMachine.stateMachineName) {
                continue;
            }
            describe(stateMachine.stateMachineName + ' - ' + stateMachine.describe, () => {
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

generateStateMachinesTests({});
