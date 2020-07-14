export const isAString = (string: any): boolean => {
    return typeof string === 'string';
};

export const isNotAnEmptyString = (string: any): boolean => {
    return typeof string === 'string' && string.length > 0;
}

export const containsWhiteSpace = (string: string): boolean => {
    return /\s/.test(string);
};