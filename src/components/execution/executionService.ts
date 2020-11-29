import { StartExecutionInput, StartExecutionOutput, DescribeExecutionInput, HistoryEvent, GetExecutionHistoryInput, StopExecutionInput, StopExecutionOutput } from "aws-sdk/clients/stepfunctions";
import * as ArnHelper from '@App/utils/ArnHelper';
import * as ValidationHelper from '@App/utils/validationHelper';
import * as ExecutionDAL from './executionDAL';
import { InvalidExecutionInputError, ExecutionAlreadyExistsError, ExecutionDoesNotExistError } from "@App/errors/AWSErrors";
import db from "@App/modules/database/db";
import { v4 as uuid } from 'uuid';
import { ExecutionStatus, IExecution, HistoryEventType } from "./execution.interfaces";
import { areObjectsEquals } from "@App/utils/objectUtils";
import { StateMachineService } from "../stateMachines";
import { UserService } from "../user";
import { executionStartedEvent } from "../events";
import { InterpretorService } from "../interpretor";
import * as Event from '../events';
import { ContextObjectService } from "../contextObject";

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

    await ContextObjectService.createContextObject({execution: result, stateMachine});
    await InterpretorService.execute({ stateName: firstStateName, rawInput: result.input, executionArn, stateMachineArn: stateMachine.arn, previousEventId: 0});
    await executionStartedEvent.emit(result)

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

export const stopExecution = async (req: StopExecutionInput): Promise<StopExecutionOutput> => {
    ValidationHelper.ensureCauseAndErrorInInputAreValid(req);
    const {executionArn} = req;

    const execution = await describeExecution(req);
    if (execution.status !== ExecutionStatus.running) {
        return {stopDate: execution.stopDate};
    }

    await Event.stopExecutionEvent.emit(req);
    await ExecutionDAL.updateExecutionStatus(db, {executionArn, newStatus: ExecutionStatus.aborted})
    await ContextObjectService.deleteContextObject(req.executionArn)

    return {stopDate: (await describeExecution(req)).stopDate}
};

export const endExecution = async (req: {executionArn: string, output?: unknown, status: ExecutionStatus}): Promise<void> => {
    ArnHelper.ensureIsValidExecutionArn(req?.executionArn);
    // todo check
    await ContextObjectService.deleteContextObject(req.executionArn)
    await ExecutionDAL.updateExecutionStatus(db, {executionArn: req.executionArn, newStatus: req.status, output: req.output});
};

type CustomHistoryEvent = Partial<HistoryEvent> & {type: HistoryEventType}
export const addEvent = async (req: {executionArn: string, event: CustomHistoryEvent}): Promise<number> => {
    // todo check
    req.event.timestamp = new Date(Date.now());
    return await ExecutionDAL.addExecutionEvent(req);
}


export const getExecutionHistory = async (req: GetExecutionHistoryInput): Promise<HistoryEvent[]> => {
    // todo
    ArnHelper.ensureIsValidExecutionArn(req.executionArn);
    const events = await ExecutionDAL.getExecutionEvent({...req, limit: 1000, offset: 0});
    return events;
}

