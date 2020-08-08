import express from "express";
import * as Logger from '../../modules/logging'
import { CreateStateMachineInput, CreateStateMachineOutput, DescribeStateMachineInput, DescribeStateMachineOutput, DeleteStateMachineInput, ListStateMachinesInput, ListStateMachinesOutput, StateMachineList, UpdateStateMachineInput, UpdateStateMachineOutput } from "aws-sdk/clients/stepfunctions";
import { IUser } from "../user/user.interfaces";
import * as StateMachineService from './stateMachineService';
import { HttpStatusCode } from "@App/utils/httpStatusCode";
import { IStateMachine } from "./stateMachine.interfaces";

export const createStateMachine =  async (req: express.Request, resp: express.Response): Promise<void> => {
    Logger.logDebug('Entering create state machine controller');
    
    const input: CreateStateMachineInput = req.body;
    const user = req.user as IUser;

    const stateMachine = await StateMachineService.createStateMachine(user.id, input);

    const toReturn: CreateStateMachineOutput = {
        creationDate: stateMachine.creationDate,
        stateMachineArn: stateMachine.arn
    };

    resp.status(HttpStatusCode.OK).send(toReturn);
};

export const describeStateMachine =  async (req: express.Request, resp: express.Response): Promise<void> => {
    Logger.logDebug('Entering describe state machine controller');

    const input: DescribeStateMachineInput = req.body;

    const stateMachine = await StateMachineService.describeStateMachine(input);

    const toReturn: DescribeStateMachineOutput = {
        creationDate: stateMachine.creationDate,
        definition: JSON.stringify(stateMachine.definition),
        name: stateMachine.name,
        roleArn: stateMachine.roleArn,
        stateMachineArn: stateMachine.arn,
        type: stateMachine.type,
        status: stateMachine.status
    };

    resp.status(HttpStatusCode.OK).send(toReturn);
};

export const deleteStateMachine = async (req: express.Request, resp: express.Response): Promise<void> => {
    Logger.logDebug('Entering delete state machine controller');

    const input: DeleteStateMachineInput = req.body;
    await StateMachineService.deleteStateMachine(input);
    resp.status(HttpStatusCode.OK).send();
};

export const listStateMachines = async (req: express.Request, resp: express.Response): Promise<void> => {
    Logger.logDebug('Entering list state machine controller');

    const input: ListStateMachinesInput = req.body;
    const result = await StateMachineService.listStateMachines(input);

    const toReturn: ListStateMachinesOutput = {
        nextToken: result.nextToken,
        stateMachines: stateMachinesToStateMachineList(result.resources)
    };
    resp.status(HttpStatusCode.OK).send(toReturn);
};

const stateMachinesToStateMachineList = (stateMachines: IStateMachine[]): StateMachineList => {
    const toReturn: StateMachineList = [];

    for (let i = 0; i < stateMachines.length; i++) {
        toReturn.push({
            creationDate: stateMachines[i].creationDate,
            name: stateMachines[i].name,
            stateMachineArn: stateMachines[i].arn,
            type: stateMachines[i].type
        })
    }
    return toReturn;
}

export const updateStateMachine = async (req: express.Request, resp: express.Response): Promise<void> => {
    Logger.logDebug('Entering update state machine controller');

    const input: UpdateStateMachineInput = req.body;
    const result = await StateMachineService.updateStateMachine(input);

    const toReturn: UpdateStateMachineOutput = {
        updateDate: result
    };

    resp.status(HttpStatusCode.OK).send(toReturn);
};
