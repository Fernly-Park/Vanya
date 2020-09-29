import { WaitState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput, Task, WaitStateTaskInfo } from "@App/components/task/task.interfaces";
import { InvalidPathError } from "@App/errors/customErrors";
import { JSONPath } from "jsonpath-plus";
import validator from "validator";
import * as TimerService from '@App/components/timer/timerService';

export const processWaitTask = async (task: Task, state: WaitState, effectiveInput: StateInput): Promise<void> => {
    let time = new Date();
    if (state.Seconds) {
        time.setSeconds(time.getSeconds() + state.Seconds);
    } else if (state.SecondsPath) {
        const seconds: number = JSONPath({json: effectiveInput as any, path: state.SecondsPath, wrap: false});
        if (!Number.isInteger(seconds) || seconds < 0) {
            throw new InvalidPathError(state.SecondsPath);
        }
        time.setSeconds(time.getSeconds() + seconds);
    } else if (state.Timestamp) {
        time = new Date(state.Timestamp);
    } else if (state.TimestampPath) {
        const timestamp: string = JSONPath({json: effectiveInput as any, path: state.TimestampPath, wrap: false});
        if (!timestamp || !validator.isRFC3339(timestamp)) {
            throw new InvalidPathError('The timestampPath parameter does not reference a valid ISO-8604 extended offset date-time format string');
        }
        time = new Date(timestamp);
    }
    const timerInfo: WaitStateTaskInfo = {...task, ...state, input: effectiveInput};
    await TimerService.addWaitTask(time, timerInfo)
}