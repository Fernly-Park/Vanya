import { PassState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput, StateOutput } from "@App/components/task/task.interfaces";

export const processPassTask = (state: PassState, effectiveInput: StateInput): StateOutput => {
    return state.Result ?? effectiveInput;
}