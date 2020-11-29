import { ContextObject, ContextObjectEnteredState } from "./contextObject.interfaces";
import * as ArnHelper from '@App/utils/ArnHelper';
import * as ContextObjectDAL from './contextObject.DAL';
import { Logger } from "@App/modules";
import { IExecution } from "../execution/execution.interfaces";
import { IStateMachine } from "../stateMachines/stateMachine.interfaces";


export const createContextObject = async (req: {execution: IExecution, stateMachine: IStateMachine}): Promise<void> => {
    const {execution, stateMachine }= req
    await ContextObjectDAL.setContextObject(execution.executionArn, {
        Execution: {
            Id: execution.executionArn,
            Input: execution.input,
            StartTime: execution.startDate,
            Name: execution.name,
            RoleArn: 'todo'
        }, 
        StateMachine : {
            Id: stateMachine.arn,
            Name: stateMachine.name
        },
    });
};

export const describeContextObject = async (req: {executionArn: string, stateName: string}): Promise<ContextObject> => {
    ArnHelper.ensureIsValidExecutionArn(req.executionArn);

    return await ContextObjectDAL.getContextObject(req.executionArn, req.stateName);
}

export const updateContextObject = async (req: {executionArn: string, enteredState: ContextObjectEnteredState, taskToken?: string, previousState?: string}): Promise<void> => {
    Logger.logDebug(`Updating context object for execution '${req.executionArn}' and state '${req.enteredState.Name}'`)
    // todo check
    if (req.previousState) {
        await ContextObjectDAL.deleteContextObject(req.executionArn, req.previousState);
    }

    await ContextObjectDAL.updateContextObject({executionArn: req.executionArn, update: req.enteredState, 
        token: req.taskToken, stateName: req.enteredState.Name, });
}

export const deleteContextObject = async (executionArn: string): Promise<void> => {
    return await ContextObjectDAL.deleteContextObject(executionArn)
}