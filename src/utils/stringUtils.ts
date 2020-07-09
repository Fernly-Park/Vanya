export const isAString = (string: any): boolean => {
    return typeof string === 'string';
};

export const containsWhiteSpace = (string: string): boolean => {
    return /\s/.test(string);
};