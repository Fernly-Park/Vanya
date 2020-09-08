import config from '@App/config';
import { AWSConstant, ACTIVITY_RESOURCE_NAME, ROLE_RESOURCE_NAME, STATE_MACHINE_RESOURCE_NAME, EXECUTION_RESOURCE_NAME } from "./constants";
import { InvalidInputError } from '@App/errors/customErrors';
import { InvalidArnError } from '@App/errors/AWSErrors';

export const arnSeparator = ':';
const arnMaxLength = 256;

type ParsedARN = {
    userId: string,
    resourceType?: string,
    resourceId: string
}

export const parseArn = (arn: string): ParsedARN => {
    if (!arn || typeof arn !== 'string' || arn.length > arnMaxLength) {
        throw new InvalidArnError(arn);
    }

    const parts = arn.split(":");
    if (parts.length < 6 || parts.length > 8) {
        throw new InvalidArnError(arn);
    }
    if(parts.length === 8) {
        return {
            userId: parts[4],
            resourceType: parts[5],
            resourceId: parts[7]
        }
    }else if (parts.length === 7) {
        return {
            userId: parts[4],
            resourceType: parts[5],
            resourceId: parts[6]
        }
    } else if (parts[5].includes('/')) {
        const lastParts = parts[5].split('/');
        return {
            userId: parts[4],
            resourceType: lastParts[0],
            resourceId: lastParts[1]
        }
    } else {
        return {
            userId: parts[4],
            resourceId: parts[6]
        }
    }
    
};

const ensureIsValidArnFactory = (resourceType: string) => {
    return (resourceArn: string) => {
        const arn = parseArn(resourceArn);
        if (arn.resourceType != resourceType) {
            throw new InvalidArnError(resourceArn);
        }
    }
}

export const ensureIsValidActivityArn = ensureIsValidArnFactory(ACTIVITY_RESOURCE_NAME);
export const ensureIsValidRoleArn = ensureIsValidArnFactory(ROLE_RESOURCE_NAME);
export const ensureStateMachineArnIsValid = ensureIsValidArnFactory(STATE_MACHINE_RESOURCE_NAME);
export const ensureIsValidExecutionArn = ensureIsValidArnFactory(EXECUTION_RESOURCE_NAME);

const generateArnFactory = (resourceType: string) => {
    return (userId: string, resourceName: string) => {
        if (typeof userId !== 'string' || typeof resourceName !== 'string') {
            throw new InvalidInputError(`user id '${userId}' and resourceName '${resourceName}' must be defined`);
        }
        return `arn:aws:${AWSConstant.serviceName}:${config.region}:${userId}:${resourceType}:${resourceName}`;
    }
};

export const generateActivityArn = generateArnFactory(ACTIVITY_RESOURCE_NAME);
export const generateStateMachineArn = generateArnFactory(STATE_MACHINE_RESOURCE_NAME);
export const generateExecutionArn = (userId: string, stateMachineName: string, executionName: string): string => {
    return `${generateArnFactory(EXECUTION_RESOURCE_NAME)(userId, stateMachineName)}:${executionName}`;
}

export const retrieveStateMachineNameFromArn = (arn: string): string => {
    const parts = arn.split(':');
    return parts[6];
}