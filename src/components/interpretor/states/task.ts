import { TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { ActivityTask, ActivityTaskStatus, StateInput, StateOutput, Task } from "@App/components/task/task.interfaces";
import { TaskResourceDoesNotExistsError } from "@App/errors/customErrors";
import * as Event from '@App/components/events';
import { applyPath } from "../path";
import { ExecutionService } from "@App/components/execution";
import { endStateExecution } from "../interpretorService";
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

    const activityTask: ActivityTask = {...task, ...state, input: effectiveInput, token, status: ActivityTaskStatus.Waiting}
    await TaskService.addActivityTask(resource, activityTask);
    if (state.TimeoutSeconds) {
        const time = new Date();
        time.setSeconds(time.getSeconds() + state.TimeoutSeconds);
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.TaskTimeout}})
    }

    if (state.HeartbeatSeconds) {
        const time = new Date();
        time.setSeconds(time.getSeconds() + state.HeartbeatSeconds);
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
    }

    await Event.activityScheduledEvent.emit({executionArn: task.executionArn, resource, heartbeatSeconds: state.HeartbeatSeconds, 
        input: effectiveInput, timeoutSeconds: state.TimeoutSeconds});
}

export const processTaskStateDone = async (activityTask: ActivityTask): Promise<void> => {
    // outputPath
    let output: StateOutput;
    try {
        output = applyPath(activityTask.output, activityTask.OutputPath);
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
    const time = new Date();
    time.setSeconds(time.getSeconds() + activityTask.HeartbeatSeconds);
    await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
}