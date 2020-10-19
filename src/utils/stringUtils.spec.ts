/* eslint-disable no-unexpected-multiline */
import { isAString, containsWhiteSpace, trimAll, stringMatches } from "@App/utils/stringUtils";

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

describe('testing trilAll function', () => {
    it('should remove all the spaces', () => {
        expect.assertions(8);

        const result = trimAll([' a ', 'b ', ' c', 'd', 'ab cd', ' ab cd ', '']);

        expect(result).toHaveLength(7);
        expect(result[0]).toBe('a');
        expect(result[1]).toBe('b');
        expect(result[2]).toBe('c');
        expect(result[3]).toBe('d');
        expect(result[4]).toBe('ab cd');
        expect(result[5]).toBe('ab cd');
        expect(result[6]).toBe('');
    })
});

describe('string matches', () => {
    it.each([
        ["hello", "hello", true,],
        ["hello", "ello", false],
        ["ello", "hello", false],
        ["foo23.log", "foo*.log", true],
        ["", "*", true],
        ["hello", "*", true],
        ["\\", "*", true],
        ["he*lo", "he\\*lo", true],
        ["he\\*lo", "he\\*lo", false],
        ["foobar.zebra", "foo*.*", true],
        ["foobar", "foo*.*", false],
        ["foobar", "foo**", true],
        ["hello**", "hello*\\*", true],
        ["hello**", "hello", true],
        ["hello", "hello*\\*", false],
        ["\\\\", "*\\\\*", true],

    ])
    ("should considere that the string '%p' matching with '%p' is %p", (str: string, rule: string, expectedResult: boolean) => {
        expect.assertions(1);

        const result = stringMatches(str, rule);

        expect(result).toBe(expectedResult);
    })

    it.each([
        ['hello', '\\']
    ])
    ("should throw if we try  the string '%p' matching with '%p'", (str: string, rule: string) => {
        expect.assertions(1);

        expect(() => stringMatches(str, rule)).toThrow();
    })

})