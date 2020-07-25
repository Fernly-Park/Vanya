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
    },
    serviceName: 'states'
}
export const ACTIVITY_RESOURCE_NAME = 'activity';
export const REQUEST_ID_HEADER = 'x-request-id';
