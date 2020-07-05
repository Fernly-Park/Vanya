import { randomIntFromInterval } from "@App/utils/numberUtils"

export const arnSeparator = ':';
export const generateArn = (resourceName: string): string => {
    const randomNumber = randomIntFromInterval(1, 999999999999);
    return `${randomNumber}${arnSeparator}${resourceName}`;
}

export const retrieveNameFromArn = (arn: string): string => {
    return arn.split(arnSeparator)[1];
}