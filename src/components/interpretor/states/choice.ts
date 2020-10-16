import { ChoiceRule, ChoiceState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput } from "@App/components/task/task.interfaces";
import { InvalidPathError, NoChoiceMatchedError } from "@App/errors/customErrors";
import { ISO8601_REGEX } from "@App/utils/validationHelper";
import { retrieveField } from "../path";

export const processChoiceState = (req: {state: ChoiceState, effectiveInput: StateInput}): string => {
    const {state} = req;

    for (const choiceRule of state.Choices) {
        if (processChoiceRule(choiceRule, req.effectiveInput)) {
            return choiceRule.Next;
        }
    }
    if (state.Default) {
        return state.Default
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
    }
}

const processANDChoice = (rule: ChoiceRule, effectiveInput: StateInput): boolean => {
    for (const choiceRule of rule.And) {
        if (!processChoiceRule(choiceRule, effectiveInput)) {
            return false;
        }
    }
    return true;
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

    // throw fatal
}

const generateDataTestComparator = (isVariableOfCorrectType: (variable: unknown) => boolean, comparator: (variable: unknown, rule: unknown) => boolean) => {
        return (rule: unknown, pathToRule: string, effectiveInput: StateInput, variable: unknown) => {
            if (!isVariableOfCorrectType(variable)) {
                return false;
            }
            if (rule !== undefined) {
                return comparator(variable, rule);
            }

            const ruleFromPath = retrieveField(effectiveInput, pathToRule);
            if (ruleFromPath === undefined) {
                throw new InvalidPathError(`Invalid Path '${pathToRule}'. The choice state's condition path references an invalid value`)
            }

            if (!isVariableOfCorrectType(ruleFromPath)) {
                return false;
            }

            return comparator(variable, ruleFromPath)
        }

}
