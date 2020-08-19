import { StartExecutionInput } from "aws-sdk/clients/stepfunctions";
import * as ArnHelper from '@App/utils/ArnHelper';
import * as ValidationHelper from '@App/utils/validationHelper';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';

import { InvalidExecutionInputError } from "@App/errors/AWSErrors";

export const startExecution = async (req: StartExecutionInput): Promise<void> => {
    ensureStartExecutionInputIsValid(req);
    const stateMachine = await StateMachineService.describeStateMachine(req);
    const firstStateName = stateMachine.definition.StartAt;
    
}

const ensureStartExecutionInputIsValid = (req: StartExecutionInput): void => {
    ArnHelper.ensureStateMachineArnIsValid(req?.stateMachineArn);
    req.name && ValidationHelper.ensureResourceNameIsValid(req.name);

    if (req.input) {
        try {
            JSON.parse(req.input);
        } catch (err) {
            throw new InvalidExecutionInputError(req.input);
        }
    }
};