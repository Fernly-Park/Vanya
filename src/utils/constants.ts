export  const AWSConstant = {
    headers: {
        CONTENT_TYPE: 'application/x-amz-json-1.0',
        TARGET_HEADER: 'x-amz-target',
        STEP_FUNCTION_PREFIX: 'AWSStepFunctions'
    },
    actions: {
        CREATE_ACTIVITY: 'CreateActivity',
        DELETE_ACTIVITY: 'DeleteActivity',
        DESCRIBE_ACTIVITY: 'DescribeActivity',
        LIST_ACTIVITIES: 'ListActivities',
        CREATE_STATE_MACHINE: 'CreateStateMachine',
        DESCRIBE_STATE_MACHINE: 'DescribeStateMachine',
        DELETE_STATE_MACHINE: 'DeleteStateMachine',
        LIST_STATE_MACHINES: 'ListStateMachines',
        UPDATE_STATE_MACHINE: 'UpdateStateMachine',
        START_EXECUTION: 'StartExecution',
        DESCRIBE_EXECUTION: 'DescribeExecution',
    },
    error: {
        STATE_RUNTIME: 'States.Runtime'
    },
    serviceName: 'states'
}
export const ACTIVITY_RESOURCE_NAME = 'activity';
export const ROLE_RESOURCE_NAME = 'role';
export const STATE_MACHINE_RESOURCE_NAME = 'stateMachine';
export const EXECUTION_RESOURCE_NAME = 'execution';
export const REQUEST_ID_HEADER = 'x-request-id';

export const LIST_RESOURCE_MAX_RESULT = 1000;
export const LIST_RESOURCE_MIN_RESULT = 0;
export const LIST_RESOURCE_DEFAULT_RESULT = 100;

export const LIST_RESOURCE_NEXT_TOKEN_MIN_LENGTH = 1;
export const LIST_RESOURCE_NEXT_TOKEN_MAX_LENGTH = 1024;

export const STATE_MACHINE_DEFINITION_MAX_LENGTH = 1048576;

