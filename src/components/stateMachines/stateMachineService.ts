import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import { InvalidInputError } from "@App/errors/customErrors";
import * as ValidationHelper from "@App/utils/validationHelper";
import * as ArnHelper from "@App/utils/ArnHelper";
import * as ASLHelper from "./asl/ASLHelper";
import { IStateMachineDefinition } from "./stateMachine.interfaces";
import * as UserService from '@App/components/user/userService';

export const createStateMachine = async (userId: string, req: CreateStateMachineInput): Promise<void> => {
    validateCreateStateMachineInput(req);
    await UserService.EnsureUserExists(userId);
    
    const stateMachineDef: IStateMachineDefinition = JSON.parse(req.definition);
    ArnHelper.generateStateMachineArn(userId, req.name);

    

};

const validateCreateStateMachineInput = (req: CreateStateMachineInput): void => {
    if (!req || ! req.name || !req.definition || !req.roleArn) {
        throw new InvalidInputError(`invalid input for creation of a state machine`);
    }

    ValidationHelper.ensureResourceNameIsValid(req.name);
    ArnHelper.ensureIsValidRoleArn(req.roleArn);
    const smDef = ASLHelper.ensureStateMachineDefinitionIsValid(req.definition);
    // todo types optionnels
};