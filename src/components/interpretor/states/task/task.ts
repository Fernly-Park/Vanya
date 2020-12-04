import { StateType, TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningTaskState, ActivityTaskStatus, StateInput, StateOutput, RunningState } from "@App/components/interpretor/interpretor.interfaces";
import { InvalidPathError, TaskResourceDoesNotExistsError, TaskTimedOutError } from "@App/errors/customErrors";
import * as Event from '@App/components/events';
import { retrieveField } from "../../path/path";
import { ActivityService } from "@App/components/activity";
import { TimerService } from "@App/components/timer";
import { AWSConstant } from "@App/utils/constants";
import { SendTaskFailureEventInput } from "@App/components/events";
import { StateMachineService } from "@App/components/stateMachines";
import { onActivityFailedEvent, onActivityScheduledEvent, onActivityStartedEvent, onActivitySucceededEvent, onActivityTimeoutEvent } from "../../historyEvent";
import { Logger } from "@App/modules";
import { endStateFailed, endStateSuccess, filterInput, filterOutput, isExecutionStillRunning } from "../../stateProcessing";
import * as TaskDAL from './taskDAL';
import { getDateIn } from "@App/utils/date";
import validator from "validator";
import { ValidationExceptionError } from "@App/errors/AWSErrors";
import { InterpretorService } from "../..";
import config from "@App/config";

export const processTaskState = async (req: {task: RunningState, state: TaskState, token: string}): Promise<void> => {
    const {task, state, token} = req;
    const effectiveInput = await filterInput(task, state);
    const resource = req.state.Resource;
    const activity = await ActivityService.getActivity(resource);
    if (!activity) {
        throw new TaskResourceDoesNotExistsError(`The activity ${resource} does not exist.`);
    }

    const heartbeatSeconds = getSecondsFromFieldOrPath(state.HeartbeatSeconds, state.HeartbeatSecondsPath, effectiveInput);
    const timeoutSeconds = getSecondsFromFieldOrPath(state.TimeoutSeconds, state.TimeoutSecondsPath, effectiveInput);

    task.previousEventId = await onActivityScheduledEvent({executionArn: task.executionArn, resource, heartbeatSeconds: heartbeatSeconds, 
        input: effectiveInput, timeoutSeconds: timeoutSeconds, previousEventId: task.previousEventId})
    const activityTask: RunningTaskState = {...task, token, status: ActivityTaskStatus.Waiting, effectiveInput, heartbeatSeconds, timeoutSeconds}
    Logger.logDebug(`adding task state '${task.stateName}' from '${task.executionArn}' with token '${token}' to the queues.`);
    await InterpretorService.saveStateInfo(activityTask);
    await TaskDAL.addTaskToActivityQueue(resource, activityTask);
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
    const activityTask = input.task;
    const { heartbeatSeconds, timeoutSeconds } = activityTask;
    Logger.logDebug(`Activity task '${activityTask.token}' started`)
    activityTask.previousEventId = await onActivityStartedEvent(input)
    await TaskDAL.modifyActivityTaskStatus(activityTask.token, activityTask.status, activityTask.previousEventId);
    if (timeoutSeconds != null) {
        const time = getDateIn(timeoutSeconds * 1000);
        Logger.logDebug(`adding timeout timer for task '${activityTask.token}'`)
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.TaskTimeout}})
    }

    if (heartbeatSeconds != null) {
        const time = getDateIn(heartbeatSeconds * 1000)
        Logger.logDebug(`adding heartbeat timer for task '${activityTask.token}'`)
        await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
    }
}

export const processTaskStateDone = async (activityTask: RunningTaskState): Promise<void> => {
    if (activityTask.status === ActivityTaskStatus.TimedOut) {
        throw new TaskTimedOutError(activityTask.token);
    }

    if (!await isExecutionStillRunning(activityTask.executionArn)) {
        await cleanTaskStateEndedHelper(activityTask);
        throw new TaskTimedOutError(activityTask.token);
    }

    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;
    let output: StateOutput;
    activityTask.previousEventId = await onActivitySucceededEvent(activityTask);
    Logger.logDebug(`task '${activityTask.token}' done`)

    try {
        output = await filterOutput(activityTask.rawInput, activityTask.output, taskState, activityTask);
    } catch (err) {
        return await endStateFailed({task: activityTask, 
            cause: `An error occurred while executing the state '${activityTask.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state: taskState
        })
    } finally {
        await cleanTaskStateEndedHelper(activityTask);
    }

    await endStateSuccess({...activityTask, output, nextStateName: taskState.Next, state: taskState});
}

export const processTaskTimeout = async (activityTaskToken: string): Promise<void> => {
    const activityTask = await InterpretorService.getStateInfo(activityTaskToken, StateType.Task) as RunningTaskState;
    if (activityTask == null) {
        return;
    }
    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;
    Logger.logDebug(`task '${activityTask.token}' timeout`)

    await cleanTaskStateEndedHelper(activityTask);

    activityTask.previousEventId = await onActivityTimeoutEvent({executionArn: activityTask.executionArn, previousEventId: activityTask.previousEventId})
    await endStateFailed({task: activityTask,
        error: AWSConstant.error.STATE_TIMEOUT,
        cause: `An error occurred while executing the state '${activityTask.stateName}'. `,
        state: taskState
    });
}

export const processTaskFailed = async (input: SendTaskFailureEventInput): Promise<void> => {
    const {activityTask} = input;
    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;
    Logger.logDebug(`task '${activityTask.token}' failed`)

    await ensureTaskIsNotTimedOut(activityTask);
    
    await cleanTaskStateEndedHelper(activityTask);
    Logger.logDebug(`sending event for '${activityTask.token}' failed`)
    activityTask.previousEventId = await onActivityFailedEvent({...input, previousEventId: activityTask.previousEventId});
    await endStateFailed({task: activityTask, 
        cause: input.cause,
        error: input.error,
        state: taskState
    });
};

const cleanTaskStateEndedHelper = async (taskState: RunningTaskState) => {
    await TaskDAL.modifyActivityTaskStatus(taskState.token, ActivityTaskStatus.TimedOut);
    await InterpretorService.deleteStateInfo(taskState, config.taskTokenTimeoutSeconds)

    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.TaskTimeout, task: taskState.token})
    await TimerService.removeTimedTask({eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout, task: taskState.token})
}

export const processTaskHeartbeat = async (activityTask: RunningTaskState): Promise<void> => {
    await ensureTaskIsNotTimedOut(activityTask);
    if (activityTask.heartbeatSeconds == null) {
        return;
    }
    Logger.logDebug(`heartbeat for task '${activityTask.token}' sent`)

    const time = new Date();
    time.setSeconds(time.getSeconds() + activityTask.heartbeatSeconds);
    await TimerService.addTimedTask({until: time, timedTask: {task: activityTask.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
}

const ensureTaskIsNotTimedOut = async (activityTask: RunningTaskState): Promise<void> => {
    if (activityTask.status === ActivityTaskStatus.TimedOut) {
        throw new TaskTimedOutError(activityTask.token);
    }
    if (!await isExecutionStillRunning(activityTask.executionArn)) {
        await cleanTaskStateEndedHelper(activityTask);
        throw new TaskTimedOutError(activityTask.token);
    }
}

export const abortTaskState = async (taskToken: string): Promise<void> => {
    if (!validator.isUUID(taskToken)) {
        throw new ValidationExceptionError(`task token '${taskToken}' is not a valid uuid`)
    }
    Logger.logDebug(`aborting state '${taskToken}'`);
    const task = await InterpretorService.getStateInfo(taskToken, StateType.Task) as RunningTaskState;
    await cleanTaskStateEndedHelper(task);
}

