
import * as ArnHelper from '@App/utils/ArnHelper';
import {readFileSync} from 'fs';
import {join} from 'path';


export const dummyId = '999999999999';
export const dummyActivityArn = ArnHelper.generateActivityArn(dummyId, 'randomName');
export const badlyFormedArnCases = [null, undefined, '', 10, 'badlyFormedArn', 'arn:aws:states:us-east-1:999999999999:activity:' + 'a'.repeat(210)];
export const badResourceNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]

const getStateMachineDef = (smName: string, valid = true): string => {
    return readFileSync(join(__dirname, 'stateMachine', 'definitions', valid ? 'valid': 'invalid', smName), 'utf8');
}

export const stateMachinesForTests = {
    invalid:  {
        invalidErrorEquals: getStateMachineDef('invalid-error-equals.json', false),
        invalidInexistantState: getStateMachineDef('invalid-inexistant-state.json', false),
        invalidJsonPath: getStateMachineDef('invalid-json-path.json', false),
        invalidMapMissingIterator: getStateMachineDef('invalid-map-missing-iterator.json', false),
        invalidParallelBranchType: getStateMachineDef('invalid-parallel-branch-type.json', false),
        invalidParallelMissingBranches: getStateMachineDef('invalid-parallel-missing-branches.json', false),
        invalidTaskAliasFunction: getStateMachineDef('invalid-task-alias-function.json', false),
        invalidUnreachableState: getStateMachineDef('invalid-unreachable-state.json', false),
    }, 
    valid: {
        validCatchFailure: getStateMachineDef('valid-catch-failure.json'),
        validChoiceState: getStateMachineDef('valid-choice-state.json'),
        validHelloWorld: getStateMachineDef('valid-hello-world.json'),
        validJobStatusPoller: getStateMachineDef('valid-job-status-poller.json'),
        validMap: getStateMachineDef('valid-map.json'),
        validMapWithCatch: getStateMachineDef('valid-map-with-catch.json'),
        validMapWithParameters: getStateMachineDef('valid-map-with-parameters.json'),
        validMapWithRetry: getStateMachineDef('valid-map-with-retry.json'),
        validParallel: getStateMachineDef('valid-parallel.json'),
        validParallelWithCatch: getStateMachineDef('valid-parallel-with-catch.json'),
        validParallelWithResultPath: getStateMachineDef('valid-parallel-with-result-path.json'),
        validParallelWithRetry: getStateMachineDef('valid-parallel-with-retry.json'),
        validPassState: getStateMachineDef('valid-pass-state.json'),
        validRetryFailure: getStateMachineDef('valid-retry-failure.json'),
        validTaskAliasFunction: getStateMachineDef('valid-task-alias-function.json'),
        validTaskBatch: getStateMachineDef('valid-task-batch.json'),
        validTaskIntrisicFunction: getStateMachineDef('valid-task-intrisic-function.json'),
        validTaskParameters: getStateMachineDef('valid-task-parameters.json'),
        validTaskTimer: getStateMachineDef('valid-task-timer.json'),
        validWaitState: getStateMachineDef('valid-wait-state.json'),
    }
}

export const dummyRoleARN = 'arn:aws:iam::012345678901:role/DummyRole';
export const dummyStateMachineArn = 'arn:aws:states:us-east-1:123456789012:stateMachine:dummySmArn';

