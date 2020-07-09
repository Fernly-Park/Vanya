import * as express from "express";
import * as logger from '../../modules/logging'
import Joi from '@hapi/joi';
import { InvalidRequestInputError } from "@App/errors/customErrors";
import { HttpStatusCode } from "@App/utils/httpStatusCode";
import * as ActivityService from "@App/components/activity/activityService";
import { CreateActivityReq, CreateActivityResp, DeleteActivityReq } from "./activity.interfaces";

const router = express.Router();

export const createActivity =  async (req: express.Request, resp: express.Response, next: express.NextFunction): Promise<void> => {
    logger.logDebug('Entering create activity controller');
    try {
        const body: CreateActivityReq = req.body;
        ensureCreateActivityReqBodyIsValid(body);
        const activity = await ActivityService.createActivity(body.name);

        logger.logInfo(`Activity '${activity.arn}' has been created and attributed the id '${activity.id}'`);

        const response: CreateActivityResp = {
            "activityArn": activity.arn,
            'creationDate': activity.creationDate
        }
        resp.status(HttpStatusCode.OK).send(response);
    } catch (error) {
        next(error);
    }
};

const ensureCreateActivityReqBodyIsValid = (activityReq: CreateActivityReq): void => {
    logger.logDebug('Ensuring the create activity request input is valid');
    const schema = Joi.object({
        name: Joi.string()
            .required()
    });

    const result = schema.validate(activityReq);
    if (result.error) {
        throw new InvalidRequestInputError(result.error.message);
    }
};

router.delete('/', async (req, resp, next) => {
    try {
        const deleteReq: DeleteActivityReq = req.body;
        ensureDeleteActivityReqBodyIsValid(deleteReq);
        await ActivityService.deleteActivity(deleteReq.activityArn)

    } catch (err) {
        next(err);
    }
})

const ensureDeleteActivityReqBodyIsValid = (deleteReq: DeleteActivityReq): void => {
    logger.logDebug('Ensuring the delete activity request input is valid');
    const schema = Joi.object({
        activityArn: Joi.string()
            .required()
            .max(256)
    });

    const result = schema.validate(deleteReq);
    if (result.error) {
        throw new InvalidRequestInputError(result.error.message);
    }
}
export default router;