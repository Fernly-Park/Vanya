import { isAString } from "../../src/utils/stringUtils";

describe('testing isAString function', () => {
    it('should detect that the argument is indeed a string', () => {
        expect.assertions(1);

        const result = isAString('test');

        expect(result).toBe(true);
    });
});