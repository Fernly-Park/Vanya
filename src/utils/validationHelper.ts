import { LIST_RESOURCE_MIN_RESULT, LIST_RESOURCE_MAX_RESULT, LIST_RESOURCE_NEXT_TOKEN_MIN_LENGTH, LIST_RESOURCE_NEXT_TOKEN_MAX_LENGTH } from "./constants";
import Joi from "@hapi/joi";
import { InvalidInputError } from "@App/errors/customErrors";
import { InvalidNameError, InvalidOutputError, InvalidTokenError } from "@App/errors/AWSErrors";
import { SendTaskSuccessInput } from "aws-sdk/clients/stepfunctions";
import { isJSON } from "./objectUtils";

export const maxResourceNameLength = 80;
export const taskOutputMaxLength = 262144;
export const taskTokenMaxLength = 1024;
export const causeMaxLength = 32768;
export const errorMaxLength = 256;

export const ensureResourceNameIsValid = (resourceName: string): void => {
    const activityNameValidator = Joi
        .string()
        .required()
        .max(maxResourceNameLength)
        .regex(/^[^\s<>{}[\]*?"#%\\^|~`$&,;:/\u0000-\u0020\u007F-\u009F]+$/)
        .message("The resource has invalid characters");
    
    const result = activityNameValidator.validate(resourceName);

    if (result.error) {
        throw new InvalidNameError(resourceName);
    }
};

export const ensureWorkerNameIsValid = (workerName: string): void  => {
    if (workerName !== null && workerName !== undefined) {
        const workerNameValidator = Joi.string()
        .min(1)
        .max(maxResourceNameLength);

        const result = workerNameValidator.validate(workerName);

        if (result.error) {
            throw new InvalidNameError(workerName);
        }
    }
}

export const ensureListResourceInputAreValid = (req?: {maxResults?: number, nextToken?: string}): void => {
    const { maxResults, nextToken } = req || {};
    ensureMaxResultsIsValid(maxResults);
    ensureNextTokenIsValid(nextToken);
}

const ensureMaxResultsIsValid = (maxResult: number): void => {
    const maxResultValidator = Joi
        .number()
        .integer()
        .min(LIST_RESOURCE_MIN_RESULT)
        .max(LIST_RESOURCE_MAX_RESULT)

    ensureIsValid(maxResult, maxResultValidator);
}

const ensureNextTokenIsValid = (nextToken: string): void => {
    const positiveNumberRegex = /^\d+$/;
    const nextTokenValidator = Joi
        .string()
        .min(LIST_RESOURCE_NEXT_TOKEN_MIN_LENGTH)
        .max(LIST_RESOURCE_NEXT_TOKEN_MAX_LENGTH)
        .regex(positiveNumberRegex);

    ensureIsValid(nextToken, nextTokenValidator, new InvalidTokenError(nextToken));
}

const ensureIsValid = (resource: unknown, validator: Joi.Schema, error?: Error): void => {
    const result = validator.validate(resource);

    if (result.error) {
        throw error ?? new InvalidInputError(result.error.message);
    }
}

export const ensureTaskTokenIsValid = (taskToken: string): void => {
    if (typeof taskToken !== 'string' || taskToken.length === 0 || taskToken.length > taskTokenMaxLength) { // todo changé lorsque réussi a répliqué le token d'amazon
        throw new InvalidTokenError(taskToken ?? '');
    }
}

export const ensureSendTaskSuccessInputIsValid = (req: SendTaskSuccessInput) => {
    if (!req?.output || !isJSON(req.output) || req.output.length > taskOutputMaxLength) {
        throw new InvalidOutputError(`Invalid Output: '${req?.output ?? ''}' is not a valid JSON`);
    }

    ensureTaskTokenIsValid(req?.taskToken);
}

export const ISO8601_REGEX = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(([+-]\d\d:\d\d)|Z)?$/i