import * as InterpretorService from '@App/components/interpretor/interpretorService';
import { InvalidPathError } from "@App/errors/customErrors";

describe('inputPath tests', () => {

    it('should discard the input if the value of the InputPath is null', () => {
        expect.assertions(1);
        const input = {a: 'b'};
        const result = InterpretorService.applyPath(input, null);
        expect(result).toStrictEqual({});
    });

    it('should work if the inputPath is correct', () => {
        expect.assertions(1);
        const input = {numbers: { val1: 3, val2: 4 }};
        const result = InterpretorService.applyPath(input, '$.numbers')

        expect(result).toStrictEqual(input.numbers);
    });

    it('should fail if the inputPath does not exists in the input', () => {
        expect.assertions(1);
        
        expect(() => InterpretorService.applyPath({}, '$.numbers')).toThrow(InvalidPathError);
    });

    it.each([{numbers: { val1: 3, val2: 4 }}, {}])('should do nothing if the inputPath is $ and the input is %p', (input) => {
        expect.assertions(1);

        const result = InterpretorService.applyPath(input, '$');
        expect(result).toStrictEqual(input)
    });

    it('should work when the input is an array', () => {
        expect.assertions(1);

        const result = InterpretorService.applyPath({ "a": [1, 2, 3, 4] }, '$.a[0,1]');
        expect(result).toStrictEqual([1, 2]);
    });
});