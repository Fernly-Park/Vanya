import { randomIntFromInterval } from "@App/utils/numberUtils";
import validator from 'validator';
import { InvalidInputError } from "@App/errors/customErrors";
import { isNotAnEmptyString } from "@App/utils/stringUtils";

export const createUser = async (sub: string, email: string, username: string): Promise<void> => {
    if (!isNotAnEmptyString(sub) ||! isNotAnEmptyString(username)) {
        throw new InvalidInputError(`the username '${username}' and the sub '${sub}' must be non empty string !`);
    }
    if (!validator.isEmail(email)) {
        throw new InvalidInputError(`email '${email}' is invalid`);
    }

    const clientId = generateId();
    
};

const generateUniqueId = async (sub: string, email: string, username: string): Promise<string> => {
    
};

const generateId = (): string => {
    const randomNumber = randomIntFromInterval(1, 999999999999);
    return randomNumber.toString().padStart(12, '0');
};
