import { TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningTaskState, ActivityTaskStatus, StateInput, StateOutput, RunningState } from "@App/components/task/task.interfaces";
import { InvalidPathError, TaskResourceDoesNotExistsError } from "@App/errors/customErrors";
import * as Event from '@App/components/events';
import { retrieveField } from "../path";
import { endStateSuccess, filterOutput, endStateFailed } from "../interpretorService";
import { TaskService } from "@App/components/task";
import { ActivityService } from "@App/components/activity";
import { TimerService } from "@App/components/timer";
import { AWSConstant } from "@App/utils/constants";
import { SendTaskFailureEventInput } from "@App/components/events";
import { StateMachineService } from "@App/components/stateMachines";
import { onActivityFailedEvent, onActivityScheduledEvent, onActivityStartedEvent, onActivitySucceededEvent, onActivityTimeoutEvent } from "../historyEvent";

export const processTaskState = async (task: RunningState, state: TaskState, effectiveInput: StateInput, token: string): Promise<void> => {
    const resource = state.Resource;
    const activity = await ActivityService.getActivity(resource);
    if (!activity) {
        throw new TaskResourceDoesNotExistsError(`The activity ${resource} does not exist.`);
    }

    const heartbeatSeconds = getSecondsFromFieldOrPath(state.HeartbeatSeconds, state.HeartbeatSecondsPath, effectiveInput);
    const timeoutSeconds = getSecondsFromFieldOrPath(state.TimeoutSeconds, state.TimeoutSecondsPath, effectiveInput);

    const activityTask: RunningTaskState = {...task, token, status: ActivityTaskStatus.Waiting, effectiveInput, heartbeatSeconds, timeoutSeconds}
    await TaskService.addActivityTask(resource, activityTask);

    await onActivityScheduledEvent({executionArn: task.executionArn, resource, heartbeatSeconds: heartbeatSeconds, 
        input: effectiveInput, timeoutSeconds: timeoutSeconds})
}

const getSecondsFromFieldOrPath = (field: number, path: string, input: StateInput): number | undefined => {
    if (path != null) {
        const toReturn = retrieveField<number>(input, path);
        if (!Number.isInteger(toReturn) || toReturn < 0) {
            throw new InvalidPathError(`Invalid path '${path}' : No valid results for path: '${path}'`)
        }
        return toReturn;
    }
    return field
}

export const processActivityTaskStarted = async (input: {task: RunningTaskState, workerName?: string}): Promise<void> => {
    await onActivityStartedEvent(input)
    const activityTask = input.task;
    const { heartbeatSeconds, timeoutSeconds } = activityTask;

    if (timeoutSeconds != null) {
        const time = new Date();
        time.setSeconds(time.getSeconds() + timeoutSeconds);
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.TaskTimeout}})
    }

    if (heartbeatSeconds != null) {
        const time = new Date();
        time.setSeconds(time.getSeconds() + heartbeatSeconds);
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
    }
}

export const processTaskStateDone = async (activityTask: RunningTaskState): Promise<void> => {
    await onActivitySucceededEvent(activityTask);
    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;
    let output: StateOutput;
    try {
        output = await filterOutput(activityTask.rawInput, activityTask.output, taskState, activityTask);
    } catch (err) {
        await TaskService.modifyActivityTaskStatus(activityTask, ActivityTaskStatus.TimedOut);
        return await endStateFailed({task: activityTask, 
            cause: `An error occurred while executing the state '${activityTask.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state: taskState
        })
    }
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.TaskTimeout, task: activityTask.token})
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout, task: activityTask.token})
    await TaskService.modifyActivityTaskStatus(activityTask, ActivityTaskStatus.TimedOut);
    await endStateSuccess({...activityTask, output, nextStateName: taskState.Next, stateType: taskState.Type});
}

export const processTaskTimeout = async (activityTaskToken: string): Promise<void> => {
    const activityTask = await TaskService.getActivityTaskFromToken(activityTaskToken);
    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;

    await cleanTaskStateFailedHelper(activityTask);
    await onActivityTimeoutEvent({executionArn: activityTask.executionArn})
    await endStateFailed({task: activityTask,
        error: AWSConstant.error.STATE_TIMEOUT,
        cause: `An error occurred while executing the state '${activityTask.stateName}'. `,
        state: taskState
    });
}

export const processTaskFailed = async (input: SendTaskFailureEventInput): Promise<void> => {
    const {activityTask} = input;
    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;

    if (activityTask.status === ActivityTaskStatus.TimedOut) {
        throw new Error('todo');
    }

    await cleanTaskStateFailedHelper(activityTask);
    await onActivityFailedEvent(input);
    await endStateFailed({task: activityTask, 
        cause: input.cause,
        error: input.error,
        state: taskState
    });
};

const cleanTaskStateFailedHelper = async (activityTask: RunningTaskState) => {
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.TaskTimeout, task: activityTask.token})
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout, task: activityTask.token})
    await TaskService.modifyActivityTaskStatus(activityTask, ActivityTaskStatus.TimedOut);
}

export const processTaskHeartbeat = async (activityTask: RunningTaskState): Promise<void> => {
    if (activityTask.status === ActivityTaskStatus.TimedOut) {
        throw new Error('todo');
    }
    if (activityTask.heartbeatSeconds == null) {
        return;
    }
    const time = new Date();
    time.setSeconds(time.getSeconds() + activityTask.heartbeatSeconds);
    await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
}