import { GetActivityTaskInput, GetActivityTaskOutput, SendTaskFailureInput, SendTaskHeartbeatInput, SendTaskSuccessInput } from "aws-sdk/clients/stepfunctions";
import { RunningTaskState, ActivityTaskStatus, RunningState } from "./task.interfaces";
import * as TaskDAL from "./taskDAL";
import { ActivityDoesNotExistError, InvalidNameError, InvalidOutputError, InvalidParameterTypeError, InvalidTokenError, TaskDoesNotExistError, ValidationExceptionError } from "@App/errors/AWSErrors";
import Joi from "@hapi/joi";
import { maxResourceNameLength } from "@App/utils/validationHelper";
import { isJSON } from "@App/utils/objectUtils";
import * as Event from '../events';
import { ActivityService } from "../activity";
import { isAString } from "@App/utils/stringUtils";
import { Logger } from "@App/modules";


export const taskOutputMaxLength = 262144;
export const taskTokenMaxLength = 1024;
export const causeMaxLength = 32768;
export const errorMaxLength = 256;

export const addGeneralTask = async (task: RunningState): Promise<void> => {
    // TODO 
    await TaskDAL.addToGeneralTaskQueue(task);
}

export const getGeneralTaskBlocking = async (): Promise<RunningState> => {
    return await TaskDAL.popFromGeneralTaskQueue();
}

export const numberOfGeneralTask = async (): Promise<number> => {
    return await TaskDAL.lengthOfGeneralTaskQueue();
}

export const addActivityTask = async (activityArn: string, task: RunningTaskState): Promise<void> => {
    await TaskDAL.addActivityTaskKeyValue(task);
    await TaskDAL.addActivityTaskToActivityQueue(activityArn, task);
}

export const getActivityTask = async (req: GetActivityTaskInput): Promise<GetActivityTaskOutput> => {
    ensureWorkerNameIsValid(req?.workerName);
    if (!await ActivityService.getActivity(req.activityArn)) {
        throw new ActivityDoesNotExistError(req?.activityArn)
    }
    //todo timeout
    const task = await TaskDAL.popActivityTask(req.activityArn);
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

export const getActivityTaskFromToken = async (taskToken: string): Promise<RunningTaskState> => {
    return await TaskDAL.retrieveActivityTaskInProgress(taskToken);
}

export const updateActivityTask = async (token: string, newStatus: ActivityTaskStatus, newPreviousEventId: number): Promise<void> => {
    // todo
    return await TaskDAL.modifyActivityTaskStatus(token, newStatus, newPreviousEventId);
};

export const sendTaskSuccess = async (req: SendTaskSuccessInput): Promise<void> => {
    ensureSendTaskSuccessInputIsValid(req);
    const activityTask = await TaskDAL.retrieveActivityTaskInProgress(req.taskToken);
    if (!activityTask) {
        throw new TaskDoesNotExistError(req.taskToken);
    }
    // todo timeout
    
    await Event.workerOutputReceivedEvent.emit({...activityTask, output: JSON.parse(req.output)})
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
    if (req?.cause != null && !isAString(req.cause)) {
        throw new InvalidParameterTypeError('Expected params.cause to be a string');
    }
    if (req?.cause != null && req.cause.length > causeMaxLength) {
        throw new ValidationExceptionError("Value at 'cause' failed to satisfy constraint: Member must have length less than or equal to 32768")
    }

    if (req?.error != null && !isAString(req.error)){
        throw new InvalidParameterTypeError('Expected params.error to be a string');
    }

    if (req?.error != null && req.error.length > causeMaxLength) {
        throw new ValidationExceptionError("Value at 'error' failed to satisfy constraint: Member must have length less than or equal to 256")
    }
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

const ensureWorkerNameIsValid = (workerName: string): void  => {
    if (workerName !== null && workerName !== undefined) {
        const workerNameValidator = Joi.string()
        .min(1)
        .max(maxResourceNameLength);

        const result = workerNameValidator.validate(workerName);

        if (result.error) {
            throw new InvalidNameError(workerName);
        }
    }
}