import { ContextObject } from "@App/components/contextObject/contextObject.interfaces";
import { InvalidPathError } from "@App/errors/customErrors";
import { dummyExecutionArn, dummyRoleARN, dummyStateMachineArn } from "@Tests/testHelper";
import { applyPath, applyPayloadTemplate, applyResultPath, retrieveField, } from './path';

describe('inputPath tests', () => {

    it('should discard the input if the value of the InputPath is null', () => {
        expect.assertions(1);
        const input = {a: 'b'};
        const result = applyPath(input, null);
        expect(result).toStrictEqual({});
    });

    it('should work if the inputPath is correct', () => {
        expect.assertions(1);
        const input = {numbers: { val1: 3, val2: 4 }};
        const result = applyPath(input, '$.numbers')

        expect(result).toStrictEqual(input.numbers);
    });

    it('should fail if the inputPath does not exists in the input', () => {
        expect.assertions(1);
        
        expect(() => applyPath({}, '$.numbers')).toThrow(InvalidPathError);
    });

    it.each([{numbers: { val1: 3, val2: 4 }}, {}])('should do nothing if the inputPath is $ and the input is %p', (input) => {
        expect.assertions(1);

        const result = applyPath(input, '$');
        expect(result).toStrictEqual(input)
    });

    it('should work when the input is an array', () => {
        expect.assertions(1);

        const result = applyPath({ "a": [1, 2, 3, 4] }, '$.a[0,1]');
        expect(result).toStrictEqual([1, 2]);
    });

    it('should work if the path is correct and the value is the input is null', () => {
        expect.assertions(1);

        const result = applyPath({numbers: null}, "$.numbers");
        expect(result).toBeNull();
    });
});

describe('parameters', () => {
    it('should correctly add the parameters to the input', () => {
        expect.assertions(1);

        const parameters = {
            "Numbers.$": "$.numbers",
            "Input.$": "$",
            "ContextObj.$": "$$",
            "CadContextObj": "$$",
            "ContextObjectSMId.$": "$$.StateMachine.Id",
            "ContextObjectExecutionId.$": "$$.Execution.Id",
            "ContextObjectExecutionName.$": "$$.Execution.Name",
            "ContextObjectStateMachineName.$": "$$.StateMachine.Name",
            "ContextObjectStateName.$": "$$.State.Name"
        };
        const StartTime = new Date();
        const EnteredTime = new Date();
        const parsedInput = {name: 3, numbers: {five: 5, sept: 7}};
        const contextObj: ContextObject = {
            Execution: {Id: dummyExecutionArn, Input: parsedInput, Name: 'executionName', RoleArn: dummyRoleARN, StartTime},
            StateMachine: {Id: dummyStateMachineArn, Name: 'smName'},
            State: {EnteredTime, Name: 'HelloWorld', RetryCount: 0}
        };
        const output = applyPayloadTemplate(contextObj, parsedInput, parameters);
        expect(output).toStrictEqual({
            CadContextObj: '$$',
            ContextObjectStateName: 'HelloWorld',
            Numbers: parsedInput.numbers,
            ContextObjectExecutionId: dummyExecutionArn,
            Input: parsedInput,
            ContextObjectStateMachineName: 'smName',
            ContextObjectSMId: dummyStateMachineArn,
            ContextObjectExecutionName: 'executionName' ,
            ContextObj: {
                Execution: {
                    Id: dummyExecutionArn,
                    Input: parsedInput,
                    Name: 'executionName',
                    StartTime,
                    RoleArn: dummyRoleARN,
                },
                State: {
                    EnteredTime,
                    Name: 'HelloWorld',
                    RetryCount: 0
                },
                StateMachine: {
                    Id: dummyStateMachineArn,
                    Name: 'smName'
                }
            }
        })
    })

    it('should work if the value in the input is null', () => {
        expect.assertions(1);

        const parameters = {
            "Numbers.$": "$.numbers",
        };

        const StartTime = new Date();
        const EnteredTime = new Date();        
        const parsedInput: Record<string, unknown> = {numbers: null};
        const contextObj: ContextObject = {
            Execution: {Id: dummyExecutionArn, Input: parsedInput, Name: 'executionName', RoleArn: dummyRoleARN, StartTime},
            StateMachine: {Id: dummyStateMachineArn, Name: 'smName'},
            State: {EnteredTime, Name: 'HelloWorld', RetryCount: 0}
        };
        const output = applyPayloadTemplate(contextObj, parsedInput, parameters);
        expect(output).toStrictEqual({Numbers: null})
    });

    it('should work using $', () => {
        expect.assertions(1);

        const parameters = {
            "Numbers.$": "$",
        };

        const StartTime = new Date();
        const EnteredTime = new Date();        
        const parsedInput: Record<string, unknown> = {"hello": "world"};
        const contextObj: ContextObject = {
            Execution: {Id: dummyExecutionArn, Input: parsedInput, Name: 'executionName', RoleArn: dummyRoleARN, StartTime},
            StateMachine: {Id: dummyStateMachineArn, Name: 'smName'},
            State: {EnteredTime, Name: 'HelloWorld', RetryCount: 0}
        };
        const output = applyPayloadTemplate(contextObj, parsedInput, parameters);
        expect(output).toStrictEqual({Numbers: parsedInput})
    })

    it('should work even if the key are nested', () => {
        expect.assertions(1);

        const parameters = {
            "Numbers": {
                "input.$": "$"
            },
        };

        const StartTime = new Date();
        const EnteredTime = new Date();        
        const parsedInput: Record<string, unknown> = {"hello": "world"};
        const contextObj: ContextObject = {
            Execution: {Id: dummyExecutionArn, Input: parsedInput, Name: 'executionName', RoleArn: dummyRoleARN, StartTime},
            StateMachine: {Id: dummyStateMachineArn, Name: 'smName'},
            State: {EnteredTime, Name: 'HelloWorld', RetryCount: 0}
        };
        const output = applyPayloadTemplate(contextObj, parsedInput, parameters);
        expect(output).toStrictEqual({Numbers: {input: parsedInput}})
    });
});

describe('result path', () => {
    it.each([
            [{"master": { "detail": [1, 2, 3] } }, {"master": {"detail": "Hello World"}}],
            [{}, {"master": {"detail": "Hello World"}}],
            [{a: 'tea'}, {a: 'tea', "master": {"detail": "Hello World"}}]
        ])('should correctly add the output in the input structure by overriding', (input, expectedOutput) => {
        expect.assertions(1);

        const output = applyResultPath(input, 'Hello World', '$.master.detail')
        expect(output).toStrictEqual(expectedOutput);
    });

    it.each([{master: 'helloWorld'},
             {},
             {hello: {world: 'Nope'}}])('Should send the input to the output', (taskOutput) => {
        expect.assertions(1);

        const result = applyResultPath({ab: 'cd'}, taskOutput, '$');
        expect(result).toStrictEqual(taskOutput);
    });

    it('should discard the task output if the resultPath is null', () => {
        expect.assertions(1);
        const input = {ab: 'cd'};
        const result = applyResultPath(input, {a: 'myOutput'}, null);
        expect(result).toStrictEqual(input);
    });
})

describe('retrieve field', () => {
    it('should work with a path of $ and an input of 0', () => {
        expect.assertions(1);

        const result = retrieveField(0, '$');
        
        expect(result).toBe(0);
    })
})