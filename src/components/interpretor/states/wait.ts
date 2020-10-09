import { WaitState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput, Task, WaitStateTaskInfo } from "@App/components/task/task.interfaces";
import { TimerService } from "@App/components/timer";
import { InvalidPathError } from "@App/errors/customErrors";
import validator from "validator";
import { endStateSuccess, endStateFailed } from "../interpretorService";
import { applyPath, retrieveField } from "../path";
import * as Event from '../../events';
import { AWSConstant } from "@App/utils/constants";

export const processWaitTask = async (task: Task, state: WaitState, effectiveInput: StateInput): Promise<void> => {
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
    const timerInfo: WaitStateTaskInfo = {...task, ...state, rawInput: effectiveInput};
    await TimerService.addTimedTask({until: time, timedTask: {task: timerInfo, eventNameForCallback: Event.CustomEvents.WaitingStateDone}})
}


export const processWaitingStateDone = async (waitingState: WaitStateTaskInfo): Promise<void> => {
    try {
        const output = applyPath(waitingState.rawInput, waitingState.OutputPath);
        await endStateSuccess({...waitingState, output, nextStateName: waitingState.Next, stateType: waitingState.Type});
    } catch (err) {
        console.log(err)
        await endStateFailed({task: waitingState, 
            cause: `An error occurred while executing the state '${waitingState.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state: waitingState
        });
    }   
}
