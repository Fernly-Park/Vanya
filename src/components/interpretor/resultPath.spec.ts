import * as InterpretorService from '@App/components/interpretor/interpretorService';

describe('result path', () => {
    it.each([
            [{"master": { "detail": [1, 2, 3] } }, {"master": {"detail": "Hello World"}}],
            [{}, {"master": {"detail": "Hello World"}}],
            [{a: 'tea'}, {a: 'tea', "master": {"detail": "Hello World"}}]
        ])('should correctly add the output in the input structure by overriding', (input, expectedOutput) => {
        expect.assertions(1);

        const output = InterpretorService.applyResultPath(input, 'Hello World', '$.master.detail')
        expect(output).toStrictEqual(expectedOutput);
    });

    it.each([{master: 'helloWorld'},
             {},
             {hello: {world: 'Nope'}}])('Should send the input to the output', (taskOutput) => {
        expect.assertions(1);

        const result = InterpretorService.applyResultPath({ab: 'cd'}, taskOutput, '$');
        expect(result).toStrictEqual(taskOutput);
    });

    it('should discard the task output if the resultPath is null', () => {
        expect.assertions(1);
        const input = {ab: 'cd'};
        const result = InterpretorService.applyResultPath(input, {a: 'myOutput'}, null);
        expect(result).toStrictEqual(input);
    });
})