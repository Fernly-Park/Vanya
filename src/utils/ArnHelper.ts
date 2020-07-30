import config from '@App/config';
import { AWSConstant, ACTIVITY_RESOURCE_NAME, ROLE_RESOURCE_NAME, STATE_MACHINE_RESOURCE_NAME } from "./constants";
import { InvalidInputError } from '@App/errors/customErrors';

export const arnSeparator = ':';
const arnMaxLength = 256;

export const parseArn = (arn: string) => {
    if (!arn || typeof arn !== 'string' || arn.length > arnMaxLength) {
        throw new InvalidInputError(`'${arn}' is not a valid arn`);
    }

    const parts = arn.split(":");
    if (parts.length !== 7) {
        throw new InvalidInputError(`'${arn}' is not a valid arn`);
    }

    return {
        userId: parts[4],
        resourceType: parts[5],
        resourceName: parts[6]
    }
};

const ensureIsValidArnFactory = (resourceType: string) => {
    return (resourceArn: string) => {
        const arn = parseArn(resourceArn);
        if (arn.resourceType != resourceType) {
            throw new InvalidInputError(`arn '${resourceArn}' is not a ${resourceType}arn`);
        }
    }
}

export const ensureIsValidActivityArn = ensureIsValidArnFactory(ACTIVITY_RESOURCE_NAME);
export const ensureIsValidRoleArn = ensureIsValidArnFactory(ROLE_RESOURCE_NAME);


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