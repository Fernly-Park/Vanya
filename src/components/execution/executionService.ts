import { StartExecutionInput, StartExecutionOutput, DescribeExecutionInput, HistoryEvent, GetExecutionHistoryInput, HistoryEventType } from "aws-sdk/clients/stepfunctions";
import * as ArnHelper from '@App/utils/ArnHelper';
import * as ValidationHelper from '@App/utils/validationHelper';
import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import * as TaskService from '@App/components/task/taskService';
import * as ExecutionDAL from './executionDAL';
import * as UserService from '@App/components/user/userService';
import { InvalidExecutionInputError, ExecutionAlreadyExistsError, ExecutionDoesNotExistError } from "@App/errors/AWSErrors";
import db from "@App/modules/database/db";
import { v4 as uuid } from 'uuid';
import { ExecutionStatus, IExecution, ContextObject, ContextObjectEnteredState } from "./execution.interfaces";
import { areObjectsEquals } from "@App/utils/objectUtils";

export const startExecution = async (userId: string, req: StartExecutionInput): Promise<StartExecutionOutput> => {
    ensureStartExecutionInputIsValid(req);
    await UserService.EnsureUserExists(userId);
    
    const stateMachine = await StateMachineService.describeStateMachine(req); // TODO verifier si pas necessaire de faire une transaction
    const firstStateName = stateMachine.definition.StartAt;
    const executionName = req.name ?? uuid();
    const executionArn = ArnHelper.generateExecutionArn(userId, stateMachine.name, executionName);
    const executionInput = req.input || '{}';

    if (req.name) {
        const existingExecution = await ExecutionDAL.selectExecutionByName(db, req.name);
        if (existingExecution && (existingExecution?.status != ExecutionStatus.running || !areObjectsEquals(existingExecution.input, JSON.parse(executionInput)))) {
            throw new ExecutionAlreadyExistsError(existingExecution.executionArn);
        } else if (existingExecution) {
            return {
                executionArn: existingExecution.executionArn,
                startDate: existingExecution.startDate
            }
        }
    }
    
    const result = await ExecutionDAL.insertExecution(db, {
        executionArn: executionArn,
        input: executionInput,
        name: executionName,
        stateMachineArn: stateMachine.arn
    });

    await ExecutionDAL.setContextObject(executionArn, {
        Execution: {
            Id: executionArn,
            Input: result.input,
            StartTime: result.startDate,
            Name: executionName,
            RoleArn: 'todo'
        }, 
        StateMachine : {
            Id: stateMachine.arn,
            Name: stateMachine.name
        }
    });

    await TaskService.addTask({ stateName: firstStateName, input: result.input, executionArn, stateMachineArn: stateMachine.arn, previousEventId: 0});
    await addEvent({executionArn, event: {
        executionStartedEventDetails: {
            input: JSON.stringify(result.input),
            roleArn: 'todo',
        },
        type: 'ExecutionStarted',
        previousEventId: 0
    }})

    return { executionArn, startDate: result.startDate }
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

export const describeExecution = async (req: DescribeExecutionInput): Promise<IExecution> => {
    ArnHelper.ensureIsValidExecutionArn(req?.executionArn);

    const toReturn = await ExecutionDAL.selectExecutionByArn(db, req.executionArn);

    if (!toReturn) {
        throw new ExecutionDoesNotExistError(req.executionArn);
    }
    return toReturn;
};

export const endExecution = async (req: {executionArn: string, output?: unknown, status: ExecutionStatus}): Promise<void> => {
    ArnHelper.ensureIsValidExecutionArn(req?.executionArn);
    // todo check
    await ExecutionDAL.updateExecutionStatus(db, {executionArn: req.executionArn, newStatus: req.status, output: req.output});
    await ExecutionDAL.deleteContextObject(req.executionArn)
};

export const retrieveExecutionContextObject = async (req: {executionArn: string}): Promise<ContextObject> => {
    ArnHelper.ensureIsValidExecutionArn(req.executionArn);

    return await ExecutionDAL.getContextObject(req.executionArn);
}

export const updateContextObjectState = async (req: {executionArn: string, enteredState: ContextObjectEnteredState}): Promise<void> => {
    // todo check
    await ExecutionDAL.updateContextObject({executionArn: req.executionArn, path: '.State', update: req.enteredState});
}

type CustomHistoryEvent = Partial<HistoryEvent> & {type: HistoryEventType, previousEventId: number}
export const addEvent = async (req: {executionArn: string, event: CustomHistoryEvent}): Promise<number> => {
    // todo check
    req.event.timestamp = new Date(Date.now());
    return await ExecutionDAL.addExecutionEvent(req);
}


export const getExecutionHistory = async (req: GetExecutionHistoryInput): Promise<HistoryEvent[]> => {
    // todo
    ArnHelper.ensureIsValidExecutionArn(req.executionArn);
    return await ExecutionDAL.getExecutionEvent({...req, limit: 1000, offset: 0});
}
