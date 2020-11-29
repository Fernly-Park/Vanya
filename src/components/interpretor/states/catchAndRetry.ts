import { AWSConstant } from "@App/utils/constants";
import { Catcher, Retrier, StateMachineStateValue, TaskState } from "../../stateMachines/stateMachine.interfaces";
import { RetryInformation, RunningState, RunningTaskState } from "../interpretor.interfaces";
import { TimerService } from "../../timer";
import { applyResultPath } from "../path/path";
import * as Event from '../../events';
import { Logger } from "@App/modules";
import * as DateUtil from '@App/utils/date';
import { v4 as uuid } from 'uuid';
import { endStateSuccess } from "../stateProcessing";
import { ContextObjectService } from "@App/components/contextObject";

export const handleCatch = async (req: {task: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<boolean> => {
    const asTaskState = req.state as TaskState
    if (req.error !== AWSConstant.error.STATE_RUNTIME && asTaskState.Catch != null) {
        for (const catcher of asTaskState.Catch) {
            const wasTheErrorCatched = await handleCatcher({...req, catcher});
            if (wasTheErrorCatched) {
                return true;
            }
        }
    }
    return false;
}

const handleCatcher = async (req: {catcher: Catcher, error?: string, task: RunningState, cause?: string, state: StateMachineStateValue}) => {
    const {catcher} = req;
    if (catcher.ErrorEquals.includes(AWSConstant.error.STATE_ALL_ERROR) || catcher.ErrorEquals.includes(req.error)) {
        Logger.logDebug(`Error '${req?.error ?? ''}' in state '${req.task.stateName}' of execution '${req.task.executionArn}' catched, 
            sending to next state '${catcher.Next}'`)
        const output = applyResultPath(req.task.rawInput, {
            Error: req.error ?? null,
            Cause: req.cause ?? null,
        }, catcher.ResultPath);
        await endStateSuccess({...req.task, state: req.state, nextStateName: catcher.Next, output});
        return true;
    }
    return false;
}


export const handleRetry = async (req: {task: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<boolean> => {
    const asTaskState = req.state as TaskState
    const canTheErrorBeRetried = req.error !== AWSConstant.error.STATE_RUNTIME && asTaskState.Retry != null;
    if (canTheErrorBeRetried) {
        req.task.retry = req.task.retry ?? initialiseRetryInformationForRunningState(req);
        return await handleRetriers(req)
    }
    return false;
}

const initialiseRetryInformationForRunningState = (req: {task: RunningState, state: StateMachineStateValue}) => {
    const asTaskState = req.state as TaskState
    const toReturn = [];
    for (const retrier of asTaskState.Retry) {
        toReturn.push({retryIntervalSeconds: retrier.IntervalSeconds == null ? 1 : retrier.IntervalSeconds, 
            retryLeft: retrier.MaxAttempts == null ? 3 : retrier.MaxAttempts
        });
    }
    return toReturn;
}

const handleRetriers = async (req: {task: RunningState, state: StateMachineStateValue, error?: string,}) => {
    const asTaskState = req.state as TaskState
    for (let i = 0; i < asTaskState.Retry.length; i++) {
        const retrier = asTaskState.Retry[i];
        const isTheErrorInThisRetrier = retrier.ErrorEquals.find(x => x === req.error || x === AWSConstant.error.STATE_ALL_ERROR) != null;
        if (isTheErrorInThisRetrier) {
            return await retryError({...req, retrier, runningRetryInfo: req.task.retry[i]})
        }
    }
    return false;
}

const retryError = async (req: {runningRetryInfo: RetryInformation, retrier: Retrier, task: RunningState, state: StateMachineStateValue}) => {
    const {runningRetryInfo, retrier, task }= req
    const asTaskState = req.state as TaskState
    const currentIntervalInSeconds = runningRetryInfo.retryIntervalSeconds;
    const currentRetryLeft = runningRetryInfo.retryLeft--
    const backoffRate = retrier.BackoffRate == null ? 2 : retrier.BackoffRate

    if (currentRetryLeft > 0) {
        runningRetryInfo.retryIntervalSeconds *= backoffRate;
        const activityTask = req.task as RunningTaskState;
        Logger.logDebug(`Retrying task '${activityTask.token}' in '${currentIntervalInSeconds}' seconds`)
        const until = DateUtil.getDateIn(Math.trunc(currentIntervalInSeconds)  * 1000);


        const taskToken = uuid();
        await ContextObjectService.updateContextObject({executionArn: task.executionArn, enteredState: {
            EnteredTime: new Date().toISOString(),
            Name: task.stateName,
        }, taskToken, previousState: task.stateName});

        const timedTask = {task, state: asTaskState, effectiveInput: activityTask.effectiveInput, token: taskToken}
        await TimerService.addTimedTask({until, timedTask: {task: timedTask, eventNameForCallback: Event.CustomEvents.ActivityTaskRetry}});
        return true;
    }
    return false;
}