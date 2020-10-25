
import * as ArnHelper from '@App/utils/ArnHelper';
import {readFileSync} from 'fs';
import {join} from 'path';
import { setupDatabaseForTests } from './fixtures/db';
import AWS from 'aws-sdk';
import config from '@App/config';
import { IStateMachine, IStateMachineDefinition, StateMachineStatus } from '@App/components/stateMachines/stateMachine.interfaces';
import { HistoryEvent, StartExecutionOutput } from 'aws-sdk/clients/stepfunctions';
import { UserService } from '@App/components/user';
import { StateMachineService } from '@App/components/stateMachines';
import { ExecutionService } from '@App/components/execution';


export const setupForTestAgainstServer = async (): Promise<AWS.StepFunctions> => {
    await setupDatabaseForTests();
    const secret = 'secret';
    const user = await UserService.createUser('sub', 'tmp@gmail.com');
    await UserService.setUserSecret(user.id, secret);
    return new AWS.StepFunctions({
        endpoint: `http://localhost:${config.port}`,
        region: config.region,
        credentials: new AWS.Credentials({accessKeyId: user.id, secretAccessKey: secret})
    });
}

export const dummyId = '999999999999';
export const dummyActivityArn = ArnHelper.generateActivityArn(dummyId, 'randomName');
export const badlyFormedArnCases = [null, undefined, '', 10, 'badlyFormedArn', 'arn:aws:states:us-east-1:999999999999:activity:' + 'a'.repeat(210)];
export const badResourceNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]

export const createStateMachineHelper = async (req: {stateMachineName?: string, userId: string, stateMachineDef?: string}): Promise<IStateMachine> => {
    return await StateMachineService.createStateMachine(req.userId, {
        name: req.stateMachineName ?? 'SMname',
        definition: req?.stateMachineDef ?? stateMachinesForTests.valid.validPassWithResult,
        roleArn: dummyRoleARN
    });
}

export const createSMAndStartExecutionHelper = async (req: {
    stateMachineName?: string,
    userId: string,
    input?: string,
    executionName?: string,
    stateMachineDef?: string
}): Promise<{execution: StartExecutionOutput, stateMachine: IStateMachine}> => {
    const stateMachine = await createStateMachineHelper(req);
    return {
        execution : await ExecutionService.startExecution(req.userId , {
            stateMachineArn: stateMachine.arn,
            input: req?.input,
            name: req?.executionName
        }),
        stateMachine: stateMachine
    };
};

export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getStateMachineDef = (...paths: string[]): string => {
    return readFileSync(join(__dirname, 'stateMachine', 'definitions', ...paths), 'utf8');
}

export const stateMachinesForTests = {
    invalid:  {
        invalidErrorEquals: getStateMachineDef('invalid', 'invalid-error-equals.json'),
        invalidInexistantState: getStateMachineDef('invalid', 'invalid-inexistant-state.json'),
        invalidJsonPath: getStateMachineDef('invalid', 'invalid-json-path.json'),
        invalidMapMissingIterator: getStateMachineDef('invalid', 'invalid-map-missing-iterator.json'),
        invalidParallelBranchType: getStateMachineDef('invalid', 'invalid-parallel-branch-type.json'),
        invalidParallelMissingBranches: getStateMachineDef('invalid', 'invalid-parallel-missing-branches.json'),
        invalidTaskAliasFunction: getStateMachineDef('invalid', 'invalid-task-alias-function.json'),
        invalidUnreachableState: getStateMachineDef('invalid', 'invalid-unreachable-state.json'),
        invalidSpaceInInputPath: getStateMachineDef('invalid', 'invalid-space-in-inputPath.json'),
        invalidWaitWithNegativeSeconds: getStateMachineDef('invalid', 'invalid-wait-with-negative-seconds.json'),
        invalidWaitTimestampEmpty: getStateMachineDef('invalid', 'invalid-wait-timestamp-empty.json'),
        invalidWaitSecondsPath: getStateMachineDef('invalid', 'invalid-wait-secondsPath.json'),
        invalidWaitTimestampPath: getStateMachineDef('invalid', 'invalid-wait-timestampPath.json'),
        invalidEmptyChoices: getStateMachineDef('invalid', 'invalid-empty-choice.json'),
    }, 
    valid: {
        validCatchFailure: getStateMachineDef('valid', 'valid-catch-failure.json'),
        validChoiceState: getStateMachineDef('valid', 'valid-choice-state.json'),
        validPass: getStateMachineDef('valid', 'pass', 'valid-pass.json'),
        validPassWithResultNull: getStateMachineDef('valid', 'pass', 'valid-pass-with-result-null.json'),
        validPassContextObject: getStateMachineDef('valid', 'pass', 'valid-pass-context-object.json'),
        validPassParameters: getStateMachineDef('valid', 'pass', 'valid-pass-parameters.json'),
        validPassIncorrectParameters: getStateMachineDef('valid', 'pass', 'valid-pass-incorrect-parameter.json'),
        validInputPathMultiple: getStateMachineDef('valid', 'inputPath', 'valid-multiple-inputPath.json'),
        validPassTwoStates: getStateMachineDef('valid', 'pass', 'valid-pass-two-states.json'),
        validPassWithResult: getStateMachineDef('valid', 'pass', 'valid-pass-with-result.json'),
        validPathResultPathNull: getStateMachineDef('valid', 'pass', 'valid-pass-resultPath-null.json'),
        validPassInputPathNull: getStateMachineDef('valid', 'pass', 'valid-pass-inputPath-null.json'),
        validWaitTimestampPath: getStateMachineDef('valid', 'wait', 'valid-wait-timestampPath.json'),
        validInputPathInPass: getStateMachineDef('valid', 'inputPath', 'valid-InputPath-in-pass.json'),
        validInputPathDefault: getStateMachineDef('valid', 'inputPath', 'valid-inputPath-default.json'),
        validResultPathInPassState: getStateMachineDef('valid', 'resultPath', 'valid-resultPath-in-pass-state.json'),
        validPassResultTwoStates: getStateMachineDef('valid', 'pass', 'valid-pass-result-two-states.json'),
        validJobStatusPoller: getStateMachineDef('valid', 'valid-job-status-poller.json'),
        validMap: getStateMachineDef('valid', 'valid-map.json'),
        validMapWithCatch: getStateMachineDef('valid', 'valid-map-with-catch.json'),
        validMapWithParameters: getStateMachineDef('valid', 'valid-map-with-parameters.json'),
        validMapWithRetry: getStateMachineDef('valid', 'valid-map-with-retry.json'),
        validParallel: getStateMachineDef('valid', 'valid-parallel.json'),
        validParallelNested: getStateMachineDef('valid', 'valid-parallel-nested.json'),
        validParallelWithCatch: getStateMachineDef('valid', 'valid-parallel-with-catch.json'),
        validParallelWithResultPath: getStateMachineDef('valid', 'valid-parallel-with-result-path.json'),
        validParallelWithRetry: getStateMachineDef('valid', 'valid-parallel-with-retry.json'),
        validTask: getStateMachineDef('valid', 'valid-task.json'),
        validPassState: getStateMachineDef('valid', 'valid-pass-state.json'),
        validRetryFailure: getStateMachineDef('valid', 'valid-retry-failure.json'),
        validTaskAliasFunction: getStateMachineDef('valid', 'valid-task-alias-function.json'),
        validTaskBatch: getStateMachineDef('valid', 'valid-task-batch.json'),
        validTaskIntrisicFunction: getStateMachineDef('valid', 'valid-task-intrisic-function.json'),
        validTaskParameters: getStateMachineDef('valid', 'valid-task-parameters.json'),
        validTaskTimer: getStateMachineDef('valid', 'valid-task-timer.json'),
        validWaitState: getStateMachineDef('valid', 'valid-wait-state.json'),
        validChoice: getStateMachineDef('valid', 'valid-choice.json'),
        validPassSpaceName: getStateMachineDef('valid', 'pass', 'valid-pass-space-stateName.json'),
    }
}

export const dummyRoleARN = 'arn:aws:iam::012345678901:role/DummyRole';
export const dummyStateMachineArn = 'arn:aws:states:us-east-1:123456789012:stateMachine:dummySmArn';
export const dummyExecutionArn = 'arn:aws:states:us-east-1:123456789012:execution:name:006f371e-4504-46be-ba47-73f88641ad71'
export const mockDateNow = '2020-06-07T00:00:01.000Z'


export type TestStateMachineTestCase = {
    input: Record<string, unknown>,
    expectedStateMachineStatus: StateMachineStatus,
    expectedOutput: string | Record<string, unknown>,
    describe: string,
    executionName: string,
    activitiesToCreate?: ActivitiyToCreateForTests[],
    eventsExpectedDuration?: EventDurationExpectedForTests[],
    events?: HistoryEvent[],
}
export type TestStateMachine = {
    definition: IStateMachineDefinition,
    describe: string,
    tests: TestStateMachineTestCase[],
    stateMachineName: string,
    folderName: string
}

export type EventDurationExpectedForTests = {
    eventId: number,
    expectedDurationInSeconds: number
    
};

export type ActivitiyToCreateForTests = {
    name: string,
    output: string,
    expectedInput: Record<string, unknown>,
    workDurationSeconds?: number,
    fail?: {
        cause?: string,
        error?: string
    } | {
        cause?: string,
        error?: string
    }[]
    waitBeforeGetActivityTaskSeconds?: number,
    workerName: string
    heartbeatIntervalSeconds?: number
}