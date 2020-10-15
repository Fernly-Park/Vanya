import { ChoiceRule, ChoiceState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput } from "@App/components/task/task.interfaces";
import { InvalidPathError, NoChoiceMatchedError } from "@App/errors/customErrors";
import { retrieveField } from "../path";

export const processChoiceState = (req: {state: ChoiceState, effectiveInput: StateInput}): string => {
    const {state} = req;

    for (const choice of state.Choices) {
        if (processChoiceRule(choice, req.effectiveInput)) {
            return choice.Next;
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
        if (variable === undefined) {
            throw new InvalidPathError(`Invalid Path '${rule.Variable}'. The choice state's condition path references an invalid value`)
        }
        return processDataTestExpression(rule, effectiveInput, variable);
    }
}

const processBooleanExpression = (rule: ChoiceRule, effectiveInput: StateInput): boolean => {
    if (rule.And) {
        return processANDChoice(rule, effectiveInput);
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
        return processBooleanEquals(rule, effectiveInput, variable);
    }
}

const processBooleanEquals = (rule: ChoiceRule, effectiveInput: StateInput, variable: unknown): boolean => {
    if (typeof variable !== 'boolean') {
        return false;
    }

    if (rule.BooleanEquals !== undefined) {
        return variable === rule.BooleanEquals;
    }

    const booleanEqualsFromInput = retrieveField<boolean>(effectiveInput, rule.BooleanEqualsPath);
    if (typeof booleanEqualsFromInput !== 'boolean') {
        return false;
    }

    return booleanEqualsFromInput === variable
}