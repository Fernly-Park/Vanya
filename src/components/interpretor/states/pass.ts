import { PassState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningState, StateOutput } from "@App/components/interpretor/interpretor.interfaces";
import { filterInput } from "../stateProcessing";

export const processPassTask = async (state: PassState, task: RunningState): Promise<StateOutput> => {
    const effectiveInput = await filterInput(task, state);
    return state.Result ?? effectiveInput;
}