import express from "express";
import * as ExecutionService from './executionService';
import { StartExecutionInput, StartExecutionOutput, DescribeExecutionInput, DescribeExecutionOutput } from "aws-sdk/clients/stepfunctions";
import { IUser } from "../user/user.interfaces";
import { HttpStatusCode } from "@App/utils/httpStatusCode";

export const startExecution = async (req: express.Request, resp: express.Response): Promise<void> => {
    const input: StartExecutionInput = req.body;
    const user = req.user as IUser;
    const result = await ExecutionService.startExecution(user.id, input);

    const toReturn: StartExecutionOutput = result
    resp.status(HttpStatusCode.OK).send(toReturn);
};

export const describeExecution = async (req: express.Request, resp: express.Response): Promise<void> => {
    const input: DescribeExecutionInput = req.body;
    const result = await ExecutionService.describeExecution(input);

    const toReturn: DescribeExecutionOutput = {
        executionArn: result.executionArn,
        input: JSON.stringify(result.input),
        startDate: result.startDate,
        stateMachineArn: result.stateMachineArn,
        status: result.status,
        name: result.name
    };
    
    resp.status(HttpStatusCode.OK).send(toReturn);
};