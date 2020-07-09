import { randomIntFromInterval } from "@App/utils/numberUtils"

export const arnSeparator = ':';
const arnMaxLength = 256;

export const generateArn = (resourceName: string): string => {
    const randomNumber = randomIntFromInterval(1, 999999999999);
    return `${randomNumber.toString().padStart(12, '0')}${arnSeparator}${resourceName}`;
};

export const retrieveNameFromArn = (arn: string): string => {
    return arn.split(arnSeparator)[1];
};