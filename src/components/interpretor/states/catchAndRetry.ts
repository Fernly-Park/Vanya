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

export const handleCatch = async (req: {stateInfo: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<boolean> => {
    const stateWithCatch = req.state as TaskState
    if (stateWithCatch.Catch != null) {
        for (const catcher of stateWithCatch.Catch) {
            const wasTheErrorCatched = await handleCatcher({...req, catcher});
            if (wasTheErrorCatched) {
                return true;
            }
        }
    }
    return false;
}

const handleCatcher = async (req: {catcher: Catcher, error?: string, stateInfo: RunningState, cause?: string, state: StateMachineStateValue}) => {
    const {catcher} = req;
    if (catcher.ErrorEquals.includes(AWSConstant.error.STATE_ALL_ERROR) || catcher.ErrorEquals.includes(req.error)) {
        Logger.logDebug(`Error '${req?.error ?? ''}' in state '${req.stateInfo.stateName}' of execution '${req.stateInfo.executionArn}' catched, 
            sending to next state '${catcher.Next}'`)
        const output = applyResultPath(req.stateInfo.rawInput, {
            Error: req.error ?? null,
            Cause: req.cause ?? null,
        }, catcher.ResultPath);
        await endStateSuccess({stateInfo: req.stateInfo, nextStateName: catcher.Next, output});
        return true;
    }
    return false;
}


export const handleRetry = async (req: {stateInfo: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<boolean> => {
    const stateWithCatch = req.state as TaskState
    
    if (stateWithCatch.Retry != null) {
        req.stateInfo.retry = req.stateInfo.retry ?? initialiseRetryInformationForRunningState(req);
        return await handleRetriers(req)
    }
    return false;
}

const initialiseRetryInformationForRunningState = (req: {stateInfo: RunningState, state: StateMachineStateValue}) => {
    const stateWithCatch = req.state as TaskState
    const toReturn = [];
    for (const retrier of stateWithCatch.Retry) {
        toReturn.push({retryIntervalSeconds: retrier.IntervalSeconds == null ? 1 : retrier.IntervalSeconds, 
            retryLeft: retrier.MaxAttempts == null ? 3 : retrier.MaxAttempts
        });
    }
    return toReturn;
}

const handleRetriers = async (req: {stateInfo: RunningState, state: StateMachineStateValue, error?: string,}) => {
    const stateWithCatch = req.state as TaskState
    for (let i = 0; i < stateWithCatch.Retry.length; i++) {
        const retrier = stateWithCatch.Retry[i];
        const isTheErrorInThisRetrier = retrier.ErrorEquals.find(x => x === req.error || x === AWSConstant.error.STATE_ALL_ERROR) != null;
        if (isTheErrorInThisRetrier) {
            return await retryError({...req, retrier, runningRetryInfo: req.stateInfo.retry[i]})
        }
    }
    return false;
}

const retryError = async (req: {runningRetryInfo: RetryInformation, retrier: Retrier, stateInfo: RunningState, state: StateMachineStateValue}) => {
    const {runningRetryInfo, retrier, stateInfo}= req
    const stateWithCatch = req.state as TaskState
    const currentIntervalInSeconds = runningRetryInfo.retryIntervalSeconds;
    const currentRetryLeft = runningRetryInfo.retryLeft--
    const backoffRate = retrier.BackoffRate == null ? 2 : retrier.BackoffRate

    if (currentRetryLeft > 0) {
        runningRetryInfo.retryIntervalSeconds *= backoffRate;
        const activityTask = req.stateInfo as RunningTaskState;
        Logger.logDebug(`Retrying task '${activityTask.stateName}' with token '${activityTask.token}' in '${currentIntervalInSeconds}' seconds`)
        const until = DateUtil.getDateIn(Math.trunc(currentIntervalInSeconds)  * 1000);


        stateInfo.token = uuid();
        await ContextObjectService.updateContextObject({executionArn: stateInfo.executionArn, enteredState: {
            EnteredTime: new Date().toISOString(),
            Name: stateInfo.stateName,
        }, taskToken: stateInfo.token, previousState: stateInfo.stateName});

        const timedTask = {task: stateInfo, state: stateWithCatch, effectiveInput: activityTask.effectiveInput, token: stateInfo.token}
        await TimerService.addTimedTask({until, timedTask: {task: timedTask, eventNameForCallback: Event.CustomEvents.TaskRetry}});
        return true;
    }
    return false;
}