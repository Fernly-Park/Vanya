import { isAString, containsWhiteSpace } from "@App/utils/stringUtils";

describe('testing isAString function', () => {
    it('should detect that the argument is indeed a string', () => {
        expect.assertions(1);

        const result = isAString('test');

        expect(result).toBe(true);
    });

    it('should detect that a number is not a string', () => {
        expect.assertions(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const test: any = 31;
        const result = isAString(test);

        expect(result).toBe(false);
    });
});

describe('testing containsWhiteSpace function', () => {

    const stringsWithWiteSpaces = [' ', "a test", "tea st", "   ", "with    tab"];
    it.each(stringsWithWiteSpaces)('should detect that %p contains white space', (stg: string) => {
        expect.assertions(1);

        const result = containsWhiteSpace(stg);

        expect(result).toBe(true);
    });

    const stringsWithoutWhiteSpace = ['', 'test']
    it.each(stringsWithoutWhiteSpace)('should detect that %p does not contains white space', (stg: string) => {
        expect.assertions(1);

        const result = containsWhiteSpace(stg);

        expect(result).toBe(false);
    });
});