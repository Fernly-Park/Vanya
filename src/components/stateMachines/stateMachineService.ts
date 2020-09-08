import { CreateStateMachineInput, DescribeStateMachineInput, DeleteStateMachineInput, UpdateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import * as ValidationHelper from "@App/utils/validationHelper";
import * as ArnHelper from "@App/utils/ArnHelper";
import * as ASLHelper from "./asl/ASLHelper";
import { IStateMachineDefinition, IStateMachine, StateMachineTypes, StateMachineStatus, StateMachineStateValue } from "./stateMachine.interfaces";
import * as UserService from '@App/components/user/userService';
import db from '../../modules/database/db'; 
import * as StateMachineDAL from './stateMachineDAL';
import { StateMachineAlreadyExistsError, StateMachineTypeNotSupportedError, StateMachineDoesNotExistsError, MissingRequiredParameterError, StateMachineDeletingError } from "@App/errors/AWSErrors";
import {areObjectsEquals} from '@App/utils/objectUtils';
import * as Logger from '@App/modules/logging';
import { listResourcesFactory } from "../ListResourceFactory";

export const createStateMachine = async (userId: string, req: CreateStateMachineInput): Promise<IStateMachine> => {
    ensureCreateStateMachineInputIsValid(req);
    await UserService.EnsureUserExists(userId);
    Logger.logDebug(`Inputs are valid, creating state machine '${req.name}'`);

    const stateMachineDef: IStateMachineDefinition = JSON.parse(req.definition);
    const arn = ArnHelper.generateStateMachineArn(userId, req.name);
    const states = ASLHelper.retrieveAllStates(stateMachineDef);
    const result = await db.transaction(async (trx) => {
        const existingSM = await StateMachineDAL.selectStateMachineByArn(trx, arn);
        
        if (existingSM && (!areObjectsEquals(existingSM.definition, stateMachineDef) || existingSM.roleArn !== req.roleArn)) {
            throw new StateMachineAlreadyExistsError(existingSM.arn);
        } else if (existingSM) {
            Logger.logDebug(`state machine '${arn}' already exists`)
            return existingSM;
        }
        await StateMachineDAL.createStateMachine(trx, arn, req, states);
        Logger.logDebug(`state machine '${arn}' created`);
        return await StateMachineDAL.selectStateMachineByArn(trx, arn);
    });

    return result;
};

const ensureCreateStateMachineInputIsValid = (req: CreateStateMachineInput): void => {
    ValidationHelper.ensureResourceNameIsValid(req.name);
    ArnHelper.ensureIsValidRoleArn(req.roleArn);
    ASLHelper.ensureStateMachineDefinitionIsValid(req.definition);

    if (req.type && req.type !== StateMachineTypes.standard && req.type !== StateMachineTypes.express) {
        throw new StateMachineTypeNotSupportedError(req.type);
    }

    // todo types optionnels
};

export const deleteStateMachine = async (req: DeleteStateMachineInput): Promise<boolean> => {
    ArnHelper.ensureStateMachineArnIsValid(req?.stateMachineArn);
    // todo, si il y a des executions, mettre le status a deleting
    return await StateMachineDAL.deleteStateMachine(db, req.stateMachineArn);
}

export const describeStateMachine = async (req: DescribeStateMachineInput): Promise<IStateMachine> => {
    ArnHelper.ensureStateMachineArnIsValid(req?.stateMachineArn);

    const toReturn = await StateMachineDAL.selectStateMachineByArn(db, req.stateMachineArn);
    if (!toReturn) {
        throw new StateMachineDoesNotExistsError(req.stateMachineArn);
    }

    return toReturn;
};


export const listStateMachines = listResourcesFactory<IStateMachine>(StateMachineDAL.countStateMachines, StateMachineDAL.selectStateMachines);

export const updateStateMachine = async (req: UpdateStateMachineInput): Promise<Date> => {
    ensureUpdateStateMachineInputIsValid(req);
    const stateMachineToUpdate = await StateMachineDAL.selectStateMachineByArn(db, req.stateMachineArn);

    if (!stateMachineToUpdate) {
        throw new StateMachineDoesNotExistsError(req.stateMachineArn);
    }

    if (stateMachineToUpdate.status === StateMachineStatus.deleting) {
        throw new StateMachineDeletingError(req.stateMachineArn);
    }

    return await StateMachineDAL.updateStateMachine(db, {
        stateMachineArn: req.stateMachineArn,
        definition: req.definition ?? JSON.stringify(stateMachineToUpdate.definition),
        roleArn: req.roleArn ?? stateMachineToUpdate.roleArn
    });
}

export const retrieveStateFromStateMachine = async (req: {stateMachineArn: string, stateName: string}): Promise<StateMachineStateValue> => {
    ArnHelper.ensureStateMachineArnIsValid(req?.stateMachineArn);
    // TODO
    
    return await StateMachineDAL.retrieveState(req)

};
const ensureUpdateStateMachineInputIsValid = (req: UpdateStateMachineInput): void => {
    if (!req?.stateMachineArn || (!req.definition && !req.roleArn)) {
        throw new MissingRequiredParameterError('required parameters missing');
    }

    ArnHelper.ensureStateMachineArnIsValid(req.stateMachineArn);
    req.roleArn && ArnHelper.ensureIsValidRoleArn(req.roleArn)
    req.definition && ASLHelper.ensureStateMachineDefinitionIsValid(req.definition);
    // todo log configuration
}