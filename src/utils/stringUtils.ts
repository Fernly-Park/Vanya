/* eslint-disable @typescript-eslint/no-explicit-any */

export const isAString = (string: any): boolean => {
    return typeof string === 'string';
};

export const isAnEmptyString = (string: any): boolean => {
    return typeof string === 'string' && string.length === 0;
}

export const containsWhiteSpace = (string: string): boolean => {
    return /\s/.test(string);
};

export const trimAll = (s: string[]): string[] => {
    const toReturn: string[] = [];
    s.forEach(currentString => {
        toReturn.push(currentString.trim());
    });

    return toReturn;
}