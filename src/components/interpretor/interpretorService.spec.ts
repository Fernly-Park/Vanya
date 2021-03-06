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
import { TimerService } from '../timer';
import { ActivityService } from '../activity';
import { clearInterval, setInterval } from 'timers';
import config from '@App/config';
import { Logger } from '@App/modules';
import { InterpretorService } from '.';
import * as RedisKey from '@App/modules/database/redisKeys'

jest.setTimeout(10000)

const getTests = (dirPath = 'tests'): TestStateMachine[] => {
    const fileNames = readdirSync(join(__dirname, dirPath));
    const toReturn: TestStateMachine[] = [];

    for (const fileName of fileNames) {
        if (statSync(join(__dirname, dirPath, fileName)).isDirectory()) {
            toReturn.push(...getTests(join(dirPath, fileName)));
        } else {
            const fileContentStringified = (readFileSync(join(__dirname, dirPath, fileName), 'utf-8'));
            let fileContent: TestStateMachine;
            try {
                fileContent = JSON.parse(fileContentStringified) as TestStateMachine
            } catch (err) {
                throw new Error(`The test file '${fileName}' is not a correct JSON file`)
            }
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

        const mustManuallyControlTheExecution = currentTest.stopExecution != null && currentTest.stopExecution.stopAfterSeconds == null;
        if (mustManuallyControlTheExecution) {
            InterpretorService.stopInterpreter();
            InterpretorService.startManualControlForTest();
        } 

        const {execution} = await TestHelper.createSMAndStartExecutionHelper({
            userId: getUser().id,
            stateMachineDef: JSON.stringify(testStateMachine.definition), 
            input: JSON.stringify(currentTest.input),
            stateMachineName: currentTest.executionName,
            executionName: currentTest.executionName ?? 'executionName'
        });
        if (currentTest.stopExecution?.stopAfterSeconds != null) {
            setTimeout(() => {
                void ExecutionService.stopExecution(execution)
            }, currentTest.stopExecution.stopAfterSeconds * 1000 * config.waitScale)
        }
        let finishedExecution = await ExecutionService.describeExecution(execution);

        if (mustManuallyControlTheExecution && finishedExecution.status === ExecutionStatus.running) {
            let stateName: string ;
            do {
                stateName = await InterpretorService.processNextState();
                finishedExecution = await ExecutionService.describeExecution(execution); 
            }while(stateName !== currentTest.stopExecution.afterStateName && finishedExecution.status === ExecutionStatus.running);
            if (stateName === currentTest.stopExecution.afterStateName) {
                await ExecutionService.stopExecution({...execution, cause: currentTest.stopExecution.cause, error: currentTest.stopExecution.error});
                while (finishedExecution.status === ExecutionStatus.running) {
                    finishedExecution = await ExecutionService.describeExecution(execution);  
                    while (await InterpretorService.processNextState());
                }
            }
        } else {
            while (finishedExecution.status === ExecutionStatus.running) {
                finishedExecution = await ExecutionService.describeExecution(execution);
                await manageWorkers(activities);
            }
        }
        
        const numberOfRemainingTasks = await Redis.llenAsync(Redis.systemTaskKey);
        const executionWasAborted = await TimerService.numberOfTimedTask() !== 0;
        const events = await ExecutionService.getExecutionHistory(execution);
        const contextObj = await Redis.hgetAllAsync(RedisKey.contextObjectKey.get(finishedExecution.executionArn));
        
        if (executionWasAborted) {
            while (await TimerService.numberOfTimedTask() !== 0);
            const executionAfterTaskTimedOut = await ExecutionService.describeExecution(execution);
            const eventsAfterTaskTimedOut = await ExecutionService.getExecutionHistory(execution);
            expect(executionAfterTaskTimedOut).toStrictEqual(finishedExecution);
            expect(eventsAfterTaskTimedOut).toStrictEqual(events);
        }
        await ensureRedisStateIsConsistent(finishedExecution);
        expect(contextObj).toBeNull();
        expect(numberOfRemainingTasks).toBe(0);
        expect(finishedExecution.status).toBe(currentTest.expectedStateMachineStatus);
        expect(finishedExecution.output).toStrictEqual(currentTest.expectedOutput);

        expect(finishedExecution.stopDate).toBeDefined();
        expect(finishedExecution.input).toStrictEqual(currentTest.input)
        if (currentTest.events) {
            expectEventsToBeCorrect(currentTest.events, events, currentTest.eventsExpectedDuration)
        } else if (currentTest.parallelEvents) {
            expectParallelEventsToBeCorrect(currentTest.parallelEvents, events, currentTest.eventsExpectedDuration);
        }
        if (currentTest.expectedNumberOfEvents !== undefined) {
            expect(events).toHaveLength(currentTest.expectedNumberOfEvents);
        }
    });
}

const ensureRedisStateIsConsistent = async (req: {executionArn: string}): Promise<void> => {
    const parallelStateInfoInRedis = await Redis.keysAsync(`${config.redis_prefix}:parallel:*`);
    expect(parallelStateInfoInRedis).toHaveLength(0);

    const key = RedisKey.currentlyRunningStateKey.get(req.executionArn);
    expect(await Redis.existsAsync(key)).toBe(false);
    const taskStatesInRedis = await Redis.keysAsync(`${config.redis_prefix}:tasks:*`);
    for(const taskKey of taskStatesInRedis) {
        expect(await Redis.ttlAsync(taskKey)).toBeGreaterThan(0);
    }
    const waitStatesInRedis = await Redis.keysAsync(`${config.redis_prefix}:wait:*`);
    expect(waitStatesInRedis).toHaveLength(0);

}

const manageWorkers = async (activities: (ActivitiyToCreateForTests & {activityArn: string})[]) => {
    if (!activities) {
        return;
    }
    for(const activity of activities) {
        activity.waitBeforeGetActivityTaskSeconds ? await TestHelper.sleep(activity.waitBeforeGetActivityTaskSeconds * 1000 * config.waitScale) : false
        const res = await InterpretorService.getActivityTask({activityArn: activity.activityArn, workerName: activity.workerName});
        if (activity.shouldReceiveATask != null) {
            const receivedATask = res.taskToken != null;
            expect(receivedATask).toBe(activity.shouldReceiveATask);
        }
        if (res.input) {
            const interval = activity.heartbeatIntervalSeconds 
            ? setInterval(() => {
                // eslint-disable-next-line jest/valid-expect-in-promise
                void InterpretorService.sendTaskHeartbeat({taskToken: res.taskToken}).then().catch((err) => {
                    Logger.logError(err ?? 'error while sending heartbeat')
                    return clearInterval(interval);
                })
            }, activity.heartbeatIntervalSeconds * 1000 * config.waitScale)
            : undefined;
            expect(JSON.parse(res.input)).toStrictEqual(activity.expectedInput);
            if (activity.workDurationSeconds) {
                await TestHelper.sleep(activity.workDurationSeconds * 1000 * config.waitScale)
            }
            try {
                interval ? clearInterval(interval) : false
                const stillNeedToSendAFailSignal = (!Array.isArray(activity.fail) || activity.fail.length > 0)
                if (activity.fail && stillNeedToSendAFailSignal) {
                    const fail = Array.isArray(activity.fail) ? activity.fail.shift() : activity.fail
                    await InterpretorService.sendTaskFailure({taskToken: res.taskToken, cause: fail.cause, error: fail.error});
                    await TestHelper.sleep(100)
                } else {
                    await InterpretorService.sendTaskSuccess({output: activity.output, taskToken: res.taskToken});
                }
            // eslint-disable-next-line no-empty
            } catch (err){
                Logger.logError(err ?? 'error trying to send a task heartbeat or failure')
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

const expectEventsToBeCorrect = (expected: HistoryEvent[], received: HistoryEvent[], expectedDurations?: EventDurationExpectedForTests[]) => {
    expect(received).toHaveLength(expected.length)
    expectEventDurationToBeCorrect(received, expectedDurations);
    for (let i = 0; i < expected.length; i++) {
        delete expected[i].timestamp;
        delete received[i].timestamp;
    }
    expect(received).toStrictEqual(expected);
}

const expectParallelEventsToBeCorrect = (expected: HistoryEvent[], received: HistoryEvent[], expectedDurations?: EventDurationExpectedForTests[]) => {
    expect(received).toHaveLength(expected.length);

    expectEventDurationToBeCorrect(received, expectedDurations);
    for(let i = 0; i < received.length; i++) {
        expect(expected[i].timestamp).toMatch(ISO8601_REGEX); delete expected[i].timestamp;
        expect(received[i].timestamp).toMatch(ISO8601_REGEX); delete received[i].timestamp;
        expect(expected[i].id).toBeGreaterThanOrEqual(0); delete expected[i].id;
        expect(received[i].id).toBeGreaterThanOrEqual(0); delete received[i].id;
        expect(expected[i].previousEventId).toBeGreaterThanOrEqual(0); delete expected[i].previousEventId;
        expect(received[i].previousEventId).toBeGreaterThanOrEqual(0); delete received[i].previousEventId;
    }

    for(let i = 0; i < received.length; i++) {
        expect(expected).toContainEqual(received[i]);
    }

    expect(received).toStrictEqual(expect.arrayContaining(expected))
}

const expectEventDurationToBeCorrect = (received: HistoryEvent[], expectedDurations?: EventDurationExpectedForTests[]): void => {
    for(let i = 0; i < received.length; i++) {
        expect(received[i].timestamp).toMatch(ISO8601_REGEX);
        const expectedDuration = expectedDurations?.find(x => x.eventId === received[i].id);
        if (expectedDuration){
            const previousEventTime = received.find(x => x.id === received[i].previousEventId).timestamp;
            const currentEventTime = new Date(received[i].timestamp);
            const previousDate = new Date(previousEventTime);
            const seconds = (currentEventTime.getTime() - previousDate.getTime()) / 1000;
            expect(Math.round(seconds * 10) / 10).toBe(expectedDuration.expectedDurationInSeconds * config.waitScale);
        }
    }
}

const modifieTimestampInWaitTests = (stateMachineTested: TestStateMachine) => {
    if (stateMachineTested.stateMachineName === 'wait-timestamp') {
        const time = new Date();
        time.setMilliseconds(time.getMilliseconds() + (config.waitScale * 1000));
        (stateMachineTested.definition.States.Hello as WaitState).Timestamp = time.toISOString()
    }

    const test = stateMachineTested.tests.find(x => x.executionName === 'timestampPathSuccess')
    if (test) {
        const time = new Date();
        time.setMilliseconds(time.getMilliseconds() + (2 * config.waitScale * 1000));
        test.input = {timestamp: time.toISOString()}
        test.expectedOutput = test.input
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

generateStateMachinesTests();
