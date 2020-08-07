import * as express from "express";
import * as ActivityController from "../../components/activity/activityController";
import * as StateMachineController from '@App/components/stateMachines/stateMachineController';
import { AWSConstant } from "@App/utils/constants";
import { UnsupportedOperationError } from "@App/errors/AWSErrors";

const router = express.Router();


router.post('/', async (req, res, next) => {
    try {
        const targetHeader = req.headers[AWSConstant.headers.TARGET_HEADER] as string
        const action = targetHeader.split('.')[1];
        switch(action) {
            case AWSConstant.actions.CREATE_ACTIVITY :
                await ActivityController.createActivity(req, res);
                break;
            case AWSConstant.actions.DELETE_ACTIVITY: 
                await ActivityController.deleteActivity(req, res);
                break;
            case AWSConstant.actions.DESCRIBE_ACTIVITY: 
                await ActivityController.describeActivity(req, res);
                break;
            case AWSConstant.actions.LIST_ACTIVITIES:
                await ActivityController.listActivities(req, res);
                break;
            case AWSConstant.actions.CREATE_STATE_MACHINE: 
                await StateMachineController.createStateMachine(req, res);
                break;
            case AWSConstant.actions.DESCRIBE_STATE_MACHINE:
                await StateMachineController.describeStateMachine(req, res);
                break;
            case AWSConstant.actions.DELETE_STATE_MACHINE: 
                await StateMachineController.deleteStateMachine(req, res);
                break;
            case AWSConstant.actions.LIST_STATE_MACHINES:
                await StateMachineController.listStateMachines(req, res);
                break;
            default :
                throw new UnsupportedOperationError(`Unsupported Operation: '${action}'`);
        }
    } catch (err) {
        next(err);
    }
    
});


export default router;