import { StartExecutionInput, StartExecutionOutput } from "aws-sdk/clients/stepfunctions";
import * as ArnHelper from '@App/utils/ArnHelper';
import * as ValidationHelper from '@App/utils/validationHelper';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import * as TaskService from '@App/components/task/taskService';
import * as ExecutionDAL from './executionDAL';
import * as UserService from '@App/components/user/userService';
import { InvalidExecutionInputError } from "@App/errors/AWSErrors";
import db from "@App/modules/database/db";
import { v4 as uuid } from 'uuid';
import { ExecutionStatus } from "./execution.interfaces";

export const startExecution = async (userId: string, req: StartExecutionInput): Promise<StartExecutionOutput> => {
    ensureStartExecutionInputIsValid(req);
    await UserService.EnsureUserExists(userId);
    
    const stateMachine = await StateMachineService.describeStateMachine(req); // TODO verifier si pas necessaire de faire une transaction
    const firstStateName = stateMachine.definition.StartAt;
    const firstState = stateMachine.definition.States[firstStateName]; 
    const executionName = req.name ?? uuid();
    const executionArn = ArnHelper.generateExecutionArn(userId, stateMachine.name, executionName);

    const result = await ExecutionDAL.insertExecution(db, {
        executionArn: executionArn,
        input: req.input || '{}',
        name: executionName,
        stateMachineArn: stateMachine.arn
    });

    await TaskService.addTask({
        state: firstState,
        input: req.input,
        executionArn
    });

    return {
        executionArn,
        startDate: result.startDate    
    }
}

const ensureStartExecutionInputIsValid = (req: StartExecutionInput): void => {
    // todo verifier si nom est unique
    ArnHelper.ensureStateMachineArnIsValid(req?.stateMachineArn);
    if (req.name !== undefined) {
        ValidationHelper.ensureResourceNameIsValid(req.name)
    }

    if (req.input) {
        try {
            JSON.parse(req.input);
        } catch (err) {
            throw new InvalidExecutionInputError(req.input);
        }
    }
};

export const endExecution = async (executionArn: string): Promise<void> => {
    ArnHelper.ensureIsValidExecutionArn(executionArn);

    await ExecutionDAL.UpdateExecutionStatus(db, {executionArn, newStatus: ExecutionStatus.succeeded});
};

