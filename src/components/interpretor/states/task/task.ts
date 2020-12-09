import { StateType, TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningTaskState, ActivityTaskStatus, StateInput, StateOutput, RunningState } from "@App/components/interpretor/interpretor.interfaces";
import { ConcurrencyError, InvalidPathError, TaskResourceDoesNotExistsError, TaskTimedOutError } from "@App/errors/customErrors";
import * as Event from '@App/components/events';
import { retrieveField } from "../../path/path";
import { ActivityService } from "@App/components/activity";
import { TimerService } from "@App/components/timer";
import { AWSConstant } from "@App/utils/constants";
import { ActivityTaskHeartbeatInput, SendTaskFailureEventInput } from "@App/components/events";
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

export const processTaskState = async (req: {task: RunningState, state: TaskState}): Promise<void> => {
    const {task, state} = req;
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
    const activityTask: RunningTaskState = {...task, token: task.token, status: ActivityTaskStatus.Waiting, effectiveInput, heartbeatSeconds, timeoutSeconds}
    Logger.logDebug(`adding task state '${task.stateName}' from '${task.executionArn}' with token '${task.token}' to the queues.`);
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

export const processActivityTaskStarted = async (input: {stateInfo: RunningTaskState, workerName?: string}): Promise<void> => {
    const activityTask = input.stateInfo;
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

export const processTaskStateDone = async (input: {stateInfo: RunningTaskState}): Promise<void> => {
    const {stateInfo} = input;
    if (stateInfo.status === ActivityTaskStatus.TimedOut) {
        throw new TaskTimedOutError(stateInfo.token);
    }

    if (!await isExecutionStillRunning(stateInfo.executionArn)) {
        await cleanTaskStateEndedHelper(stateInfo);
        throw new TaskTimedOutError(stateInfo.token);
    }

    const taskState = (await StateMachineService.retrieveStateFromStateMachine(stateInfo)) as TaskState;
    let output: StateOutput;
    stateInfo.previousEventId = await onActivitySucceededEvent(stateInfo);
    Logger.logDebug(`task '${stateInfo.token}' done`)

    try {
        output = await filterOutput(stateInfo.rawInput, stateInfo.output, taskState, stateInfo);
    } catch (err) {
        return await endStateFailed({stateInfo: stateInfo, 
            cause: `An error occurred while executing the state '${stateInfo.stateName}'. ${(err as Error)?.message ?? ''}`,
            error: AWSConstant.error.STATE_RUNTIME,
            state: taskState
        })
    } finally {
        await cleanTaskStateEndedHelper(stateInfo);
    }

    await endStateSuccess({stateInfo: stateInfo, output, nextStateName: taskState.Next});
}

export const processTaskTimeout = async (activityTaskToken: string): Promise<void> => {
    const activityTask = await InterpretorService.getStateInfo(activityTaskToken, StateType.Task) as RunningTaskState;
    if (activityTask == null) {
        return;
    }
    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;
    Logger.logDebug(`task '${activityTask.token}' timeout`)

    try {
        await cleanTaskStateEndedHelper(activityTask);
    } catch (err) {
        if (err instanceof ConcurrencyError) {
            return;
        }
    }

    activityTask.previousEventId = await onActivityTimeoutEvent({executionArn: activityTask.executionArn, previousEventId: activityTask.previousEventId})
    await endStateFailed({stateInfo: activityTask,
        error: AWSConstant.error.STATE_TIMEOUT,
        cause: `An error occurred while executing the state '${activityTask.stateName}'. `,
        state: taskState
    });
}

export const processTaskFailed = async (input: SendTaskFailureEventInput): Promise<void> => {
    const {stateInfo: activityTask} = input;
    const taskState = (await StateMachineService.retrieveStateFromStateMachine(activityTask)) as TaskState;
    Logger.logDebug(`task '${activityTask.token}' failed`)

    await ensureTaskIsNotTimedOut(activityTask);
    
    await cleanTaskStateEndedHelper(activityTask);
    Logger.logDebug(`sending event for '${activityTask.token}' failed`)
    activityTask.previousEventId = await onActivityFailedEvent({...input, previousEventId: activityTask.previousEventId});
    await endStateFailed({stateInfo: activityTask, 
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

export const processTaskHeartbeat = async (req: ActivityTaskHeartbeatInput): Promise<void> => {
    const {stateInfo} = req
    await ensureTaskIsNotTimedOut(stateInfo);
    if (stateInfo.heartbeatSeconds == null) {
        return;
    }
    Logger.logDebug(`heartbeat for task '${stateInfo.token}' sent`)

    const time = new Date();
    time.setSeconds(time.getSeconds() + stateInfo.heartbeatSeconds);
    await TimerService.addTimedTask({until: time, timedTask: {task: stateInfo.token, eventNameForCallback: Event.CustomEvents.ActivityTaskHeartbeatTimeout}})
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

