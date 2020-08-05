import assert from 'assert';

export const areObjectsEquals = (actual: any, expected: any): boolean => {
    try {
        assert.deepStrictEqual(actual, expected);
        return true;
    } catch (err) {
        return false;
    }
}