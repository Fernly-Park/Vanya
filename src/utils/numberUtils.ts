import { InvalidInputError } from "@App/errors/customErrors";

export const randomIntFromInterval = (min: number, max: number): number => { 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

export const isANumber = (n: string): boolean => !isNaN(n as unknown as number)
