import { GetActivityTaskInput, GetActivityTaskOutput, SendTaskSuccessInput } from "aws-sdk/clients/stepfunctions";
import { ActivityTask, Task } from "./task.interfaces";
import * as TaskDAL from "./taskDAL";
import { ActivityDoesNotExistError, InvalidNameError, InvalidOutputError, InvalidTokenError, TaskDoesNotExistError } from "@App/errors/AWSErrors";
import Joi from "@hapi/joi";
import { maxResourceNameLength } from "@App/utils/validationHelper";
import { isJSON } from "@App/utils/objectUtils";
import * as Event from '../events';
import { ActivityService } from "../activity";


export const taskOutputMaxLength = 262144;
export const taskTokenMaxLength = 1024;

export const addTask = async (task: Task): Promise<void> => {
    // TODO 
    await TaskDAL.addToGeneralTaskQueue(task);
}

export const getGeneralTaskBlocking = async (): Promise<Task> => {
    return await TaskDAL.popFromGeneralTaskQueue();
}

export const numberOfGeneralTask = async (): Promise<number> => {
    return await TaskDAL.lengthOfGeneralTaskQueue();
}

export const addActivityTask = async (activityArn: string, input: ActivityTask): Promise<void> => {
    await TaskDAL.addActivityTaskToActivityQueue(activityArn, input);
}



export const getActivityTask = async (req: GetActivityTaskInput): Promise<GetActivityTaskOutput> => {
    ensureWorkerNameIsValid(req?.workerName);
    if (!await ActivityService.getActivity(req.activityArn)) {
        throw new ActivityDoesNotExistError(req?.activityArn)
    }

    const task = await TaskDAL.popActivityTask(req.activityArn);
    if (task) {
        await TaskDAL.addActivityTaskToInProgress(task);
        await Event.activityStartedEvent.emit({executionArn: task.executionArn, workerName: req.workerName})
    }
    return {
        input: task === null ? null : JSON.stringify(task.input),
        taskToken: task === null ? null : task.token
    }
}

export const sendTaskSuccess = async (req: SendTaskSuccessInput): Promise<void> => {
    ensureSendTaskSuccessInputIsValid(req);

    const activityTask = await TaskDAL.retrieveActivityTaskInProgress(req.taskToken);
    if (!activityTask) {
        throw new TaskDoesNotExistError(req.taskToken);
    }
    // todo timeout
    console.log('req: ', req)
    await Event.activityTaskSucceededEvent.emit({...activityTask, output: JSON.parse(req.output)})
}

const ensureSendTaskSuccessInputIsValid = (req: SendTaskSuccessInput) => {
    if (!req?.output || !isJSON(req.output) || req.output.length > taskOutputMaxLength) {
        throw new InvalidOutputError(`Invalid Output: '${req?.output ?? ''}' is not a valid JSON`);
    }

    if (typeof req.taskToken !== 'string' || req.taskToken.length === 0 || req.taskToken.length > taskTokenMaxLength) { // todo changé lorsque réussi a répliqué le token d'amazon
        throw new InvalidTokenError(req?.taskToken ?? '');
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