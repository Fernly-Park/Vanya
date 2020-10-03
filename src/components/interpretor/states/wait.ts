import { WaitState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput, Task, WaitStateTaskInfo } from "@App/components/task/task.interfaces";
import { TimerService } from "@App/components/timer";
import { InvalidPathError } from "@App/errors/customErrors";
import { JSONPath } from "jsonpath-plus";
import validator from "validator";
import { endStateExecution } from "../interpretorService";
import { applyPath } from "../path";
import * as Event from '../../events';
import { ExecutionService } from "@App/components/execution";
import { ExecutionStatus } from "@App/components/execution/execution.interfaces";

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
        console.log('timestamp : ', timestamp)
        if (!timestamp || !validator.isRFC3339(timestamp)) {
            throw new InvalidPathError('The timestampPath parameter does not reference a valid ISO-8604 extended offset date-time format string');
        }
        time = new Date(timestamp);
    }
    const timerInfo: WaitStateTaskInfo = {...task, ...state, input: effectiveInput};
    await TimerService.addWaitTask(time, timerInfo)
}


export const processWaitingStateDone = async (waitingState: WaitStateTaskInfo): Promise<void> => {
    try {
        const output = applyPath(waitingState.input, waitingState.OutputPath);
        await endStateExecution({...waitingState, output, nextStateName: waitingState.Next, stateType: waitingState.Type});
    } catch (err) {
        console.log(err)
        await Event.executionFailedEvent.emit({...waitingState, description: (err as Error)?.message})
        return await ExecutionService.endExecution({executionArn: waitingState.executionArn, status: ExecutionStatus.failed})
    }   
}
