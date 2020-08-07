import { LIST_RESOURCE_MIN_RESULT, LIST_RESOURCE_MAX_RESULT, LIST_RESOURCE_NEXT_TOKEN_MIN_LENGTH, LIST_RESOURCE_NEXT_TOKEN_MAX_LENGTH } from "./constants";
import Joi from "@hapi/joi";
import { InvalidInputError } from "@App/errors/customErrors";
import { InvalidNameError, InvalidTokenError } from "@App/errors/AWSErrors";

const maxResourceNameLength = 80;

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