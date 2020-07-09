import * as ArnHelper from "@App/utils/ArnHelper";


describe('arn helper function', () => {
    it('correctly create an arn', () => {
        expect.assertions(2);
        const resourceName = 'test';

        const result = ArnHelper.generateArn(resourceName);
        const splittedResult = result.split(':');

        expect(splittedResult[0]).toHaveLength(12);
        expect(splittedResult[1]).toBe(resourceName);
    }); 

    it('correctly retrieve a name through an arn', () => {
        expect.assertions(1);

        const result = ArnHelper.retrieveNameFromArn('999999999999:test')

        expect(result).toBe('test');
    });
});