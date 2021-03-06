import { ChoiceRule, ChoiceState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningState, StateInput } from "@App/components/interpretor/interpretor.interfaces";
import { FatalError, InvalidPathError, NoChoiceMatchedError } from "@App/errors/customErrors";
import { stringMatches } from "@App/utils/stringUtils";
import { ISO8601_REGEX } from "@App/utils/validationHelper";
import { retrieveField } from "../path/path";
import { filterInput } from "../stateProcessing";

export const processChoiceState = async (req: {state: ChoiceState, task: RunningState}): Promise<{next: string, effectiveInput: StateInput}> => {
    const {state} = req;
    const effectiveInput = await filterInput(req.task, state);

    for (const choiceRule of state.Choices) {
        if (processChoiceRule(choiceRule, effectiveInput)) {
            return {next: choiceRule.Next, effectiveInput};
        }
    }
    if (state.Default) {
        return {next: state.Default, effectiveInput}
    }

    throw new NoChoiceMatchedError('Failed to transition out of the state. The state does not point to a next state')
}

const processChoiceRule = (rule: ChoiceRule, effectiveInput: StateInput): boolean => {
    
    if (rule.And || rule.Or || rule.Not) {
        return processBooleanExpression(rule, effectiveInput);
    } else  {
        const variable = retrieveField(effectiveInput, rule.Variable);
        if (variable === undefined && rule.IsPresent === undefined) {
            throw new InvalidPathError(`Invalid Path '${rule.Variable}'. The choice state's condition path references an invalid value`)
        }
        return processDataTestExpression(rule, effectiveInput, variable);
    }
}

const processBooleanExpression = (rule: ChoiceRule, effectiveInput: StateInput): boolean => {
    if (rule.And) {
        return processANDChoice(rule, effectiveInput);
    } else if (rule.Not) {
        return !processChoiceRule(rule.Not, effectiveInput);
    } else if (rule.Or) {
        return processOrChoice(rule, effectiveInput);
    }
    throw new FatalError ('Boolean expression in choice state should contain an AND or a NOT or a; OR')
}

const processANDChoice = (rule: ChoiceRule, effectiveInput: StateInput): boolean => {
    for (const choiceRule of rule.And) {
        if (!processChoiceRule(choiceRule, effectiveInput)) {
            return false;
        }
    }
    return true;
}

const processOrChoice = (rule: ChoiceRule, effectiveInput: StateInput): boolean => {
    for (const choiceRule of rule.Or) {
        if (processChoiceRule(choiceRule, effectiveInput)) {
            return true;
        }
    }
    return false;
}

const processDataTestExpression = (rule: ChoiceRule, effectiveInput: StateInput, variable: unknown): boolean => {
    if (rule.BooleanEquals !== undefined || rule.BooleanEqualsPath !== undefined) {
        const processBooleanEquals = generateDataTestComparator((v) => typeof v === 'boolean', (a1, a2) => a1 === a2)
        return processBooleanEquals(rule.BooleanEquals, rule.BooleanEqualsPath, effectiveInput, variable);
    }
    if (rule.NumericEquals !== undefined || rule.NumericEqualsPath !== undefined) {
        const processNumericEquals = generateDataTestComparator(v => typeof v === 'number', (a1, a2) => a1 === a2)
        return processNumericEquals(rule.NumericEquals, rule.NumericEqualsPath, effectiveInput, variable);
    }
    if (rule.NumericGreaterThan !== undefined || rule.NumericGreaterThanPath !== undefined) {
        const processNumericGreaterThan = generateDataTestComparator(v => typeof v === 'number', (variable, rule) => variable > rule);
        return processNumericGreaterThan(rule.NumericGreaterThan, rule.NumericGreaterThanPath, effectiveInput, variable)
    }
    if (rule.NumericGreaterThanEquals !== undefined || rule.NumericGreaterThanEqualsPath !== undefined) {
        const processNumericGreaterThanEquals = generateDataTestComparator(v => typeof v === 'number', (variable, rule) => variable >= rule);
        return processNumericGreaterThanEquals(rule.NumericGreaterThanEquals, rule.NumericGreaterThanEqualsPath, effectiveInput, variable);
    }
    if (rule.NumericLessThan !== undefined || rule.NumericLessThanPath !== undefined) {
        const processNumericLessThan = generateDataTestComparator(v => typeof v === 'number', (variable, rule) => variable < rule);
        return processNumericLessThan(rule.NumericLessThan, rule.NumericLessThanPath, effectiveInput, variable);
    }
    if (rule.NumericLessThanEquals !== undefined || rule.NumericLessThanEqualsPath !== undefined) {
        const processNumericLessThanEquals = generateDataTestComparator(v => typeof v === 'number', (variable, rule) => variable <= rule);
        return processNumericLessThanEquals(rule.NumericLessThanEquals, rule.NumericLessThanEqualsPath, effectiveInput, variable);
    }
    if (rule.StringEquals !== undefined || rule.StringEqualsPath !== undefined) {
        const processStringEquals = generateDataTestComparator(v => typeof v === 'string', (variable, rule) => variable === rule);
        return processStringEquals(rule.StringEquals, rule.StringEqualsPath, effectiveInput, variable);
    }
    if (rule.StringGreaterThan !== undefined || rule.StringGreaterThanPath !== undefined) {
        const processStringGreaterThan = generateDataTestComparator(v => typeof v === 'string', (variable, rule) => variable > rule)
        return processStringGreaterThan(rule.StringGreaterThan, rule.StringGreaterThanPath, effectiveInput, variable);
    }
    if (rule.StringGreaterThanEquals !== undefined || rule.StringGreaterThanEqualsPath !== undefined) {
        const processStringGreaterThanEquals = generateDataTestComparator(v => typeof v === 'string', (variable, rule) => variable >= rule);
        return processStringGreaterThanEquals(rule.StringGreaterThanEquals, rule.StringGreaterThanEqualsPath, effectiveInput, variable);
    }
    if (rule.StringLessThan !== undefined || rule.StringLessThanPath !== undefined) {
        const processStringLessThan = generateDataTestComparator(v => typeof v === 'string', (variable, rule) => variable < rule);
        return processStringLessThan(rule.StringLessThan, rule.StringLessThanPath, effectiveInput, variable);
    }
    if (rule.StringLessThanEquals !== undefined || rule.StringLessThanEqualsPath !== undefined) {
        const processStringLessThanEquals = generateDataTestComparator(v => typeof v === 'string', (variable, rule) => variable <= rule);
        return processStringLessThanEquals(rule.StringLessThanEquals, rule.StringLessThanEqualsPath, effectiveInput, variable);
    }
    if (rule.StringMatches !== undefined) {
        const processStringMatches = generateDataTestComparator(v => typeof v === 'string', (variable, rule) => stringMatches(variable as string, rule as string));
        return processStringMatches(rule.StringMatches, undefined, effectiveInput, variable);
    }
    const ensureIsTimestamp = (v: unknown) => typeof v === 'string' && ISO8601_REGEX.test(v);
    if (rule.TimestampEquals !== undefined || rule.TimestampEqualsPath !== undefined) {
        const processTimestampEquals = generateDataTestComparator(ensureIsTimestamp, 
            (variable, rule) => new Date(variable as string).getTime() === new Date(rule as string).getTime());
        return processTimestampEquals(rule.TimestampEquals, rule.TimestampEqualsPath, effectiveInput, variable);
    }
    if (rule.TimestampGreaterThan !== undefined || rule.TimestampGreaterThanPath !== undefined) {
        const processTimestampGreaterThan = generateDataTestComparator(ensureIsTimestamp, 
            (variable, rule) => new Date(variable as string).getTime() > new Date(rule as string).getTime());
        return processTimestampGreaterThan(rule.TimestampGreaterThan, rule.TimestampGreaterThanPath, effectiveInput, variable);
    }
    if (rule.TimestampLessThan !== undefined || rule.TimestampLessThanPath !== undefined) {
        const processTimestampLessThan = generateDataTestComparator(ensureIsTimestamp, 
            (variable, rule) => new Date(variable as string).getTime() < new Date(rule as string).getTime());
        return processTimestampLessThan(rule.TimestampLessThan, rule.TimestampLessThanPath, effectiveInput, variable);
    }
    if (rule.TimestampGreaterThanEquals !== undefined || rule.TimestampGreaterThanEqualsPath !== undefined) {
        const processTimestampGreaterThanEquals = generateDataTestComparator(ensureIsTimestamp, 
            (variable, rule) => new Date(variable as string).getTime() >= new Date(rule as string).getTime());
        return processTimestampGreaterThanEquals(rule.TimestampGreaterThanEquals, rule.TimestampGreaterThanEqualsPath, effectiveInput, variable);
    }
    if (rule.TimestampLessThanEquals !== undefined || rule.TimestampLessThanEqualsPath !== undefined) {
        const processTimestamplessThanEquals = generateDataTestComparator(ensureIsTimestamp, 
            (variable, rule) => new Date(variable as string).getTime() <= new Date(rule as string).getTime());
        return processTimestamplessThanEquals(rule.TimestampLessThanEquals, rule.TimestampLessThanEqualsPath, effectiveInput, variable);

    }
    if (rule.IsBoolean !== undefined) {
        return (rule.IsBoolean && typeof variable === 'boolean') || (!rule.IsBoolean && typeof variable !== 'boolean');
    }
    if (rule.IsNull !== undefined) {
        return (rule.IsNull && variable === null) || (!rule.IsNull && variable !== null);
    }
    if (rule.IsNumeric !== undefined) {
        return (rule.IsNumeric && typeof variable === 'number') || (!rule.IsNumeric && typeof variable !== 'number');
    }
    if (rule.IsPresent !== undefined) {
        return (rule.IsPresent && variable !== undefined) || (!rule.IsPresent && variable === undefined);
    }
    if (rule.IsString !== undefined) {
        return (rule.IsString && typeof variable === 'string') || (!rule.IsString && typeof variable !== 'string');
    }
    if (rule.IsTimestamp !== undefined) {
        return (rule.IsTimestamp && typeof variable === 'string' && ISO8601_REGEX.test(variable)) 
            || (!rule.IsTimestamp && !ISO8601_REGEX.test(variable as string))
    }

    throw new FatalError(`A choice state cannot have custom rule.`);
}

const generateDataTestComparator = (isVariableOfCorrectType: (variable: unknown) => boolean, comparator: (variable: unknown, rule: unknown) => boolean) => {
        return (rule: unknown, pathToRule: string, effectiveInput: StateInput, variable: unknown) => {
            let ruleFromPath;

            if (pathToRule !== undefined) {
                ruleFromPath = retrieveField(effectiveInput, pathToRule);
                if (ruleFromPath === undefined) {
                    throw new InvalidPathError(`Invalid Path '${pathToRule}'. The choice state's condition path references an invalid value`)
                }
            }

            if (!isVariableOfCorrectType(variable)) {
                return false;
            }
            if (rule !== undefined) {
                return comparator(variable, rule);
            }

            
            if (!isVariableOfCorrectType(ruleFromPath)) {
                return false;
            }

            return comparator(variable, ruleFromPath)
        }

}

