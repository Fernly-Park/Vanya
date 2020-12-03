import { WaitState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningState } from "@App/components/interpretor/interpretor.interfaces";
import { TimerService } from "@App/components/timer";
import { InvalidPathError } from "@App/errors/customErrors";
import validator from "validator";
import { retrieveField } from "../../path/path";
import * as Event from '../../../events';
import { AWSConstant } from "@App/utils/constants";
import { StateMachineService } from "@App/components/stateMachines";
import { Logger } from "@App/modules";
import { getDateIn } from "@App/utils/date";
import { endStateFailed, endStateSuccess, filterInput, filterOutput } from "../../stateProcessing";
import { InterpretorDAL, InterpretorService } from "../..";

export const processWaitTask = async (task: RunningState, state: WaitState): Promise<void> => {
    const effectiveInput = await filterInput(task, state);
    let time = new Date();
    if (state.Seconds) {
        time = getDateIn(state.Seconds * 1000)
    } else if (state.SecondsPath) {
        const seconds = retrieveField<number>(effectiveInput, state.SecondsPath)
        if (!Number.isInteger(seconds) || seconds < 0) { 
            throw new InvalidPathError(state.SecondsPath);
        }
        time = getDateIn(seconds * 1000)
    } else if (state.Timestamp) {
        time = new Date(state.Timestamp);
    } else if (state.TimestampPath) {
        const timestamp = retrieveField<string>(effectiveInput, state.TimestampPath);
        if (!timestamp || !validator.isRFC3339(timestamp)) {
            throw new InvalidPathError('The timestampPath parameter does not reference a valid ISO-8604 extended offset date-time format string');
        }
        time = new Date(timestamp);
    }

    await InterpretorService.saveStateInfo(task);
    Logger.logDebug(`Waiting state '${task.stateName}' of '${task.executionArn}' started. waiting until '${time.toISOString()}'`)
    await TimerService.addTimedTask({until: time, timedTask: {task: task.token, eventNameForCallback: Event.CustomEvents.WaitingStateDone}})
}


export const processWaitingStateDone = async (token: string): Promise<void> => {
    const task = await InterpretorDAL.getWaitStateInfo(token);
    const executionWasAborted = task == null;
    if (executionWasAborted) {
        return;
    }
    Logger.logDebug(`Waiting for state '${task.stateName}' of '${task.executionArn}' finished, resuming state machine processing`)

    const waitingState = (await StateMachineService.retrieveStateFromStateMachine(task)) as WaitState;
    const effectiveInput = await filterInput(task, waitingState);
    try {
        const output = await filterOutput(task.rawInput, effectiveInput, waitingState, task);
        await endStateSuccess({...task, output, nextStateName: waitingState.Next, state: waitingState});
    } catch (err) {
        Logger.logError(err ?? 'caca');
        await endStateFailed({task, 
            cause: `An error occurred while executing the state '${task.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state: waitingState
        });
    }   
}
