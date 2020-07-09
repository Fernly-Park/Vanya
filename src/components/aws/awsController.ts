import * as express from "express";
import * as ActivityController from "../activity/activityController";
import { AWSConstant } from "@App/utils/constants";
import { UnsupportedOperationError } from "@App/errors/AWSErrors";

const router = express.Router();


router.post('/', async (req, res, next) => {
    try {
        const targetHeader = req.headers[AWSConstant.headers.TARGET_HEADER] as string
        const action = targetHeader.split('.')[1];
        switch(action) {
            case AWSConstant.actions.CREATE_ACTIVITY :
                await ActivityController.createActivity(req, res, next);
                break;
            default :
                throw new UnsupportedOperationError(`Unsupported Operation: '${action}'`);
        }
    } catch (err) {
        next(err);
    }
    
});


export default router;