import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import * as ValidationHelper from "@App/utils/validationHelper";
import * as ArnHelper from "@App/utils/ArnHelper";
import * as ASLHelper from "./asl/ASLHelper";
import { IStateMachineDefinition, IStateMachine, StateMachineTypes } from "./stateMachine.interfaces";
import * as UserService from '@App/components/user/userService';
import db from '../../modules/database/db'; 
import * as StateMachineDAL from './stateMachineDAL';
import { StateMachineAlreadyExists, StateMachineTypeNotSupported } from "@App/errors/AWSErrors";
import {areObjectsEquals} from '@App/utils/objectUtils';
import * as Logger from '@App/modules/logging';

export const createStateMachine = async (userId: string, req: CreateStateMachineInput): Promise<IStateMachine> => {
    validateCreateStateMachineInput(req);
    await UserService.EnsureUserExists(userId);
    Logger.logDebug(`Inputs are valid, creating state machine '${req.name}'`);

    const stateMachineDef: IStateMachineDefinition = JSON.parse(req.definition);
    const arn = ArnHelper.generateStateMachineArn(userId, req.name);
    
    const result = await db.transaction(async (trx) => {
        const existingSM = await StateMachineDAL.selectStateMachineByArn(trx, arn);
        
        if (existingSM && (!areObjectsEquals(existingSM.definition, stateMachineDef) || existingSM.roleArn !== req.roleArn)) {
            throw new StateMachineAlreadyExists(existingSM.arn);
        } else if (existingSM) {
            Logger.logDebug(`state machine '${arn}' already exists`)
            return existingSM;
        }
        await StateMachineDAL.createStateMachine(trx, arn, req);
        Logger.logDebug(`state machine '${arn}' created`);
        return await StateMachineDAL.selectStateMachineByArn(trx, arn);
    });

    return result;
};

const validateCreateStateMachineInput = (req: CreateStateMachineInput): void => {
    ValidationHelper.ensureResourceNameIsValid(req.name);
    ArnHelper.ensureIsValidRoleArn(req.roleArn);
    ASLHelper.ensureStateMachineDefinitionIsValid(req.definition);

    if (req.type && req.type !== StateMachineTypes.standard && req.type !== StateMachineTypes.express) {
        throw new StateMachineTypeNotSupported(`'${req.type}'`);
    }

    // todo types optionnels
};