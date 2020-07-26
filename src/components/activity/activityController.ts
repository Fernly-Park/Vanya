import * as express from "express";
import * as logger from '../../modules/logging'
import { InvalidInputError, UnexistingResourceError } from "@App/errors/customErrors";
import { HttpStatusCode } from "@App/utils/httpStatusCode";
import * as ActivityService from "@App/components/activity/activityService";
import { IUser } from "../user/user.interfaces";
import { CreateActivityOutput, DescribeActivityOutput, CreateActivityInput, DeleteActivityInput, DescribeActivityInput, ListActivitiesInput, ListActivitiesOutput } from "aws-sdk/clients/stepfunctions";

const router = express.Router();

export const createActivity =  async (req: express.Request, resp: express.Response): Promise<void> => {
    logger.logDebug('Entering create activity controller');
    
    const body: CreateActivityInput = req.body;
    const user = req.user as IUser;
    if (!body.name) {
        throw new InvalidInputError(`name must be defined`);
    }
    const activity = await ActivityService.createActivity(user.id, body.name);

    logger.logInfo(`Activity '${activity.activityArn}' has been created`);

    const response: CreateActivityOutput = {
        "activityArn": activity.activityArn,
        'creationDate': activity.creationDate
    }
    resp.status(HttpStatusCode.OK).send(response);
};

export const deleteActivity = async (req: express.Request, resp: express.Response): Promise<void> => {
    logger.logDebug('Entering delete activity controller');
    
    const body: DeleteActivityInput = req.body;
    await ActivityService.deleteActivity(body.activityArn);

    resp.status(HttpStatusCode.OK).send();
}

export const describeActivity = async (req: express.Request, resp: express.Response): Promise<void> => {
    logger.logDebug('Entering describe activity');
    const body: DescribeActivityInput = req.body;
    const activity = await ActivityService.getActivity(body.activityArn);
    if (!activity) {
        throw new UnexistingResourceError(`activity '${body.activityArn}' does not exists`);
    }
    const response: DescribeActivityOutput = activity;
    resp.status(HttpStatusCode.OK).send(response);
};

export const listActivities = async (req: express.Request, resp: express.Response): Promise<void> => {
    logger.logDebug('Entering list Activities');
    
    const {activities, nextToken} = await ActivityService.listActivities(req.body);

    const response: ListActivitiesOutput = {
        activities,
        nextToken
    }

    resp.status(HttpStatusCode.OK).send(response);
};

export default router;