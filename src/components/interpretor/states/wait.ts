import { WaitState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput, RunningState } from "@App/components/task/task.interfaces";
import { TimerService } from "@App/components/timer";
import { InvalidPathError } from "@App/errors/customErrors";
import validator from "validator";
import { endStateSuccess, endStateFailed, filterInput, filterOutput } from "../interpretorService";
import { applyPath, retrieveField } from "../path";
import * as Event from '../../events';
import { AWSConstant } from "@App/utils/constants";
import { StateMachineService } from "@App/components/stateMachines";

export const processWaitTask = async (task: RunningState, state: WaitState, effectiveInput: StateInput): Promise<void> => {
    let time = new Date();
    if (state.Seconds) {
        time.setSeconds(time.getSeconds() + state.Seconds);
    } else if (state.SecondsPath) {
        const seconds = retrieveField<number>(effectiveInput, state.SecondsPath)
        if (!Number.isInteger(seconds) || seconds < 0) {
            throw new InvalidPathError(state.SecondsPath);
        }
        time.setSeconds(time.getSeconds() + seconds);
    } else if (state.Timestamp) {
        time = new Date(state.Timestamp);
    } else if (state.TimestampPath) {
        const timestamp = retrieveField<string>(effectiveInput, state.TimestampPath);
        if (!timestamp || !validator.isRFC3339(timestamp)) {
            throw new InvalidPathError('The timestampPath parameter does not reference a valid ISO-8604 extended offset date-time format string');
        }
        time = new Date(timestamp);
    }
    await TimerService.addTimedTask({until: time, timedTask: {task, eventNameForCallback: Event.CustomEvents.WaitingStateDone}})
}


export const processWaitingStateDone = async (task: RunningState): Promise<void> => {
    const waitingState = (await StateMachineService.retrieveStateFromStateMachine(task)) as WaitState;
    const effectiveInput = await filterInput(task, waitingState);
    try {
        const output = await filterOutput(task.rawInput, effectiveInput, waitingState, task);
        await endStateSuccess({...task, output, nextStateName: waitingState.Next, stateType: waitingState.Type});
    } catch (err) {
        console.log(err)
        await endStateFailed({task, 
            cause: `An error occurred while executing the state '${task.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state: waitingState
        });
    }   
}
