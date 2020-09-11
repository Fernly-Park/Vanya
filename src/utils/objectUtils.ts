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

export const isJSON = (item: string): boolean => {
    item = typeof item !== "string"
        ? JSON.stringify(item)
        : item;

    try {
        item = JSON.parse(item);
    } catch (e) {
        return false;
    }

    return typeof item === "object" && item !== null;
}

export const addProps = (obj: Record<string, unknown>, arr: string | string[], val: unknown): Record<string, unknown> => {

    if (typeof arr === 'string')
        arr = arr.split(".");

    obj[arr[0]] = obj[arr[0]] || {};

    const tmpObj = obj[arr[0]];

    if (arr.length > 1) {
        arr.shift();
        addProps(tmpObj as Record<string, unknown>, arr, val);
    }
    else
        obj[arr[0]] = val;

    return obj;
}