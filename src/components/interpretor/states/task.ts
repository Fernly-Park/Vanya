import { TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { ActivityTask, ActivityTaskStatus, StateInput, StateOutput, Task } from "@App/components/task/task.interfaces";
import { InvalidPathError, TaskResourceDoesNotExistsError } from "@App/errors/customErrors";
import * as Event from '@App/components/events';
import { retrieveField } from "../path";
import { ExecutionService } from "@App/components/execution";
import { endStateExecution, filterOutput } from "../interpretorService";
import { ExecutionStatus } from "@App/components/execution/execution.interfaces";
import { TaskService } from "@App/components/task";
import { ActivityService } from "@App/components/activity";
import { TimerService } from "@App/components/timer";
import { AWSConstant } from "@App/utils/constants";

export const processTaskState = async (task: Task, state: TaskState, effectiveInput: StateInput, token: string): Promise<void> => {
    const resource = state.Resource;
    const activity = await ActivityService.getActivity(resource);
    if (!activity) {
        throw new TaskResourceDoesNotExistsError(`The activity ${resource} does not exist.`);
    }

    const heartbeatSeconds = getSecondsFromFieldOrPath(state.HeartbeatSeconds, state.HeartbeatSecondsPath, effectiveInput);
    const timeoutSeconds = getSecondsFromFieldOrPath(state.TimeoutSeconds, state.TimeoutSecondsPath, effectiveInput);

    const activityTask: ActivityTask = {...task, ...state, token, status: ActivityTaskStatus.Waiting, effectiveInput}
    await TaskService.addActivityTask(resource, activityTask);

    await Event.activityScheduledEvent.emit({executionArn: task.executionArn, resource, heartbeatSeconds: (heartbeatSeconds as number), 
        input: effectiveInput, timeoutSeconds: (timeoutSeconds as number)});
}

const getSecondsFromFieldOrPath = (field: number, path: string, input: StateInput): number | void => {
    if (path != null) {
        const toReturn = retrieveField<number>(input, path);
        if (!Number.isInteger(toReturn) || toReturn < 0) {
            throw new InvalidPathError(`Invalid path '${path}' : No valid results for path: '${path}'`)
        }
        return toReturn;
    }
    return field
}

export const processActivityTaskStarted = async (input: Event.ActivityStartedEventInput): Promise<void> => {
    const activityTask = input.task;
    const heartbeatSeconds = getSecondsFromFieldOrPath(activityTask.HeartbeatSeconds, activityTask.HeartbeatSecondsPath, activityTask.rawInput);
    const timeoutSeconds = getSecondsFromFieldOrPath(activityTask.TimeoutSeconds, activityTask.TimeoutSecondsPath, activityTask.rawInput);

    if (timeoutSeconds != null) {
        const time = new Date();
        time.setSeconds(time.getSeconds() + (timeoutSeconds as number));
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.TaskTimeout}})
    }

    if (heartbeatSeconds != null) {
        const time = new Date();
        time.setSeconds(time.getSeconds() + (heartbeatSeconds as number));
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
    }
}

export const processTaskStateDone = async (activityTask: ActivityTask): Promise<void> => {
    // outputPath
    let output: StateOutput;
    try {
        output = await filterOutput(activityTask.rawInput, activityTask.output, activityTask, activityTask);
    } catch (err) {
        await TaskService.modifyActivityTaskStatus(activityTask, ActivityTaskStatus.TimedOut);
        await Event.executionFailedEvent.emit({...activityTask, description: (err as Error)?.message});
        return await ExecutionService.endExecution({executionArn: activityTask.executionArn, status: ExecutionStatus.failed});
    }
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.TaskTimeout, task: activityTask.token})
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout, task: activityTask.token})
    await TaskService.modifyActivityTaskStatus(activityTask, ActivityTaskStatus.TimedOut);
    await Event.activitySucceededEvent.emit({executionArn: activityTask.executionArn, output});
    await endStateExecution({...activityTask, output, nextStateName: activityTask.Next, stateType: activityTask.Type});
}

export const processTaskTimeout = async (activityTaskToken: string): Promise<void> => {
    const activityTask = await TaskService.getActivityTaskFromToken(activityTaskToken)
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.TaskTimeout, task: activityTask.token})
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout, task: activityTask.token})
    await TaskService.modifyActivityTaskStatus(activityTask, ActivityTaskStatus.TimedOut);
    await Event.activityTimeoutEvent.emit({executionArn: activityTask.executionArn});
    await Event.executionFailedEvent.emit({...activityTask, error: AWSConstant.error.STATE_TIMEOUT});
    await ExecutionService.endExecution({executionArn: activityTask.executionArn, status: ExecutionStatus.failed});
}

export const processTaskHeartbeat = async (activityTask: ActivityTask): Promise<void> => {
    if (activityTask.status === ActivityTaskStatus.TimedOut) {
        throw new Error('todo');
    }
    const heartbeatSeconds = getSecondsFromFieldOrPath(activityTask.HeartbeatSeconds, activityTask.HeartbeatSecondsPath, activityTask.rawInput)
    if (heartbeatSeconds == null) {
        return;
    }
    const time = new Date();
    time.setSeconds(time.getSeconds() + (heartbeatSeconds as number));
    await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
}