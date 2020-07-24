import * as express from "express";
import * as logger from '../../modules/logging'
import Joi from '@hapi/joi';
import { InvalidInputError } from "@App/errors/customErrors";
import { HttpStatusCode } from "@App/utils/httpStatusCode";
import * as ActivityService from "@App/components/activity/activityService";
import { CreateActivityReq, CreateActivityResp, DeleteActivityReq } from "./activity.interfaces";
import { IUser } from "../user/user.interfaces";

const router = express.Router();

export const createActivity =  async (req: express.Request, resp: express.Response): Promise<void> => {
    logger.logDebug('Entering create activity controller');
    
    const body: CreateActivityReq = req.body;
    const user = req.user as IUser;
    if (!body.name) {
        throw new InvalidInputError(`name must be defined`);
    }
    const activity = await ActivityService.createActivity(user.id, body.name);

    logger.logInfo(`Activity '${activity.arn}' has been created and attributed the id '${activity.id}'`);

    const response: CreateActivityResp = {
        "activityArn": activity.arn,
        'creationDate': activity.creationDate
    }
    resp.status(HttpStatusCode.OK).send(response);
};

export const deleteActivity = async (req: express.Request, resp: express.Response): Promise<void> => {
    logger.logDebug('Entering delete activity controller');
    
    const body: DeleteActivityReq = req.body;
    if (!body.activityArn) {
        throw new InvalidInputError('The request must contains the activityArn field');
    }
    await ActivityService.deleteActivity(body.activityArn);

    resp.status(HttpStatusCode.OK).send();
}

export default router;