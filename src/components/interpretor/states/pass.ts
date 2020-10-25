import { PassState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningState, StateOutput } from "@App/components/task/task.interfaces";
import { filterInput } from "../interpretorService";

export const processPassTask = async (state: PassState, task: RunningState): Promise<StateOutput> => {
    const effectiveInput = await filterInput(task, state);
    return state.Result ?? effectiveInput;
}