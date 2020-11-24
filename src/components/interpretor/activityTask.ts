import { ActivityDoesNotExistError, TaskDoesNotExistError, InvalidOutputError, InvalidTokenError } from "@App/errors/AWSErrors";
import { Logger } from "@App/modules";
import { isJSON } from "@App/utils/objectUtils";
import { ensureWorkerNameIsValid, taskOutputMaxLength, taskTokenMaxLength, ensureCauseAndErrorInInputAreValid } from "@App/utils/validationHelper";
import { GetActivityTaskInput, GetActivityTaskOutput, SendTaskHeartbeatInput, SendTaskSuccessInput, SendTaskFailureInput } from "aws-sdk/clients/stepfunctions";
import { ActivityService } from "../activity";
import { ActivityTaskStatus } from "./interpretor.interfaces";
import * as Event from '../events';
import { isExecutionStillRunning } from "./stateProcessing";
import * as TaskDAL from './states/task/taskDAL';

export const getActivityTask = async (req: GetActivityTaskInput): Promise<GetActivityTaskOutput> => {
    ensureWorkerNameIsValid(req?.workerName);
    if (!await ActivityService.getActivity(req.activityArn)) {
        throw new ActivityDoesNotExistError(req?.activityArn)
    }
    //todo timeout

    let task = await TaskDAL.popActivityTask(req.activityArn);
    while (task && !await isExecutionStillRunning(task.executionArn)) {
        await TaskDAL.deleteActivityTask(task.token);
        task = await TaskDAL.popActivityTask(req.activityArn)
    }
    if (task) {
        await TaskDAL.modifyActivityTaskStatus(task.token, ActivityTaskStatus.Running);
        await Event.activityStartedEvent.emit({task: task, workerName: req.workerName})
    }
    return {
        input: task === null ? null : JSON.stringify(task.effectiveInput),
        taskToken: task === null ? null : task.token
    }
}

export const sendTaskHeartbeat = async (req: SendTaskHeartbeatInput): Promise<void> => {
    ensureTaskTokenIsValid(req?.taskToken);
    const activityTask = await TaskDAL.retrieveActivityTaskInProgress(req.taskToken);

    if (!activityTask) {
        throw new TaskDoesNotExistError(req.taskToken);
    }
    // todo timeout
    await Event.activityTaskHeartbeat.emit(activityTask);
}

export const sendTaskSuccess = async (req: SendTaskSuccessInput): Promise<void> => {
    ensureSendTaskSuccessInputIsValid(req);
    const activityTask = await TaskDAL.retrieveActivityTaskInProgress(req.taskToken);
    if (!activityTask) {
        throw new TaskDoesNotExistError(req.taskToken);
    }
    // todo timeout
    
    await Event.workerOutputReceivedEvent.emit({...activityTask, output: JSON.parse(req.output)})
}

const ensureSendTaskSuccessInputIsValid = (req: SendTaskSuccessInput) => {
    if (!req?.output || !isJSON(req.output) || req.output.length > taskOutputMaxLength) {
        throw new InvalidOutputError(`Invalid Output: '${req?.output ?? ''}' is not a valid JSON`);
    }

    ensureTaskTokenIsValid(req?.taskToken);
}


const ensureTaskTokenIsValid = (taskToken: string): void => {
    if (typeof taskToken !== 'string' || taskToken.length === 0 || taskToken.length > taskTokenMaxLength) { // todo changé lorsque réussi a répliqué le token d'amazon
        throw new InvalidTokenError(taskToken ?? '');
    }
}

export const sendTaskFailure = async (req: SendTaskFailureInput): Promise<void> => {
    ensureSendTaskFailureInputIsValid(req);
    Logger.logInfo(`Task failure sent for '${req.taskToken}'`)
    const activityTask = await TaskDAL.retrieveActivityTaskInProgress(req.taskToken);
    if (!activityTask) {
        Logger.logWarning(`Task failure sent for '${req.taskToken}'`)
        throw new TaskDoesNotExistError(req.taskToken);
    }
    await Event.sendTaskFailureEvent.emit({activityTask, cause: req.cause, error: req.error})
}

const ensureSendTaskFailureInputIsValid = (req: SendTaskFailureInput): void => {
    ensureTaskTokenIsValid(req?.taskToken);
    ensureCauseAndErrorInInputAreValid(req);
}