import assert from 'assert';

export const areObjectsEquals = (actual: any, expected: any): boolean => {
    try {
        assert.deepStrictEqual(actual, expected);
        return true;
    } catch (err) {
        return false;
    }
}

export const deepCopy = (obj: Record<string, unknown>): Record<string, unknown> => {
    return JSON.parse(JSON.stringify(obj)) as Record<string, unknown>
}

export const isAnObject = (obj: unknown): boolean => {
    return typeof obj === 'object' && obj !== null;
}