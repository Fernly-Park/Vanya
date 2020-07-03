export const isAString = (string: string): boolean => {
    return typeof string === 'string';
};

export const containsWhiteSpace = (string: string): boolean => {
    return /\s/.test(string);
};