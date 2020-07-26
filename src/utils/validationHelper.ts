import { LIST_RESOURCE_MIN_RESULT, LIST_RESOURCE_MAX_RESULT, LIST_RESOURCE_NEXT_TOKEN_MIN_LENGTH, LIST_RESOURCE_NEXT_TOKEN_MAX_LENGTH } from "./constants";
import Joi from "@hapi/joi";
import { InvalidInputError } from "@App/errors/customErrors";

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

    ensureIsValid(nextToken, nextTokenValidator);
}

const ensureIsValid = (resource: unknown, validator: Joi.Schema): void => {
    const result = validator.validate(resource);

    if (result.error) {
        throw new InvalidInputError(result.error.message);
    }
}