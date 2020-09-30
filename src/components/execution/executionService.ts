import { StartExecutionInput, StartExecutionOutput, DescribeExecutionInput, HistoryEvent, GetExecutionHistoryInput } from "aws-sdk/clients/stepfunctions";
import * as ArnHelper from '@App/utils/ArnHelper';
import * as ValidationHelper from '@App/utils/validationHelper';
import * as ExecutionDAL from './executionDAL';
import { InvalidExecutionInputError, ExecutionAlreadyExistsError, ExecutionDoesNotExistError } from "@App/errors/AWSErrors";
import db from "@App/modules/database/db";
import { v4 as uuid } from 'uuid';
import { ExecutionStatus, IExecution, ContextObject, ContextObjectEnteredState, HistoryEventType } from "./execution.interfaces";
import { areObjectsEquals } from "@App/utils/objectUtils";
import { IStateMachineDefinition, ParallelState, PassState, StateType } from "../stateMachines/stateMachine.interfaces";
import { StateMachineService } from "../stateMachines";
import { TaskService } from "../task";
import { UserService } from "../user";

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
        },
    });

    await TaskService.addTask({ stateName: firstStateName, input: result.input, executionArn, stateMachineArn: stateMachine.arn});
    await addEvent({executionArn, event: {
        executionStartedEventDetails: {
            input: JSON.stringify(result.input),
            roleArn: 'todo',
        },
        type: HistoryEventType.ExecutionStarted
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

export const retrieveExecutionContextObject = async (req: {executionArn: string, stateName: string}): Promise<ContextObject> => {
    ArnHelper.ensureIsValidExecutionArn(req.executionArn);

    return await ExecutionDAL.getContextObject(req.executionArn, req.stateName);
}

export const updateContextObject = async (req: {executionArn: string, enteredState: ContextObjectEnteredState, taskToken?: string, previousState?: string}): Promise<void> => {
    // todo check
    if (req.previousState) {
        await ExecutionDAL.deleteContextObject(req.executionArn, req.previousState);
    }
    await ExecutionDAL.updateContextObject({executionArn: req.executionArn, update: req.enteredState, 
        token: req.taskToken, stateName: req.enteredState.Name, });
}


type CustomHistoryEvent = Partial<HistoryEvent> & {type: HistoryEventType}
export const addEvent = async (req: {executionArn: string, event: CustomHistoryEvent}): Promise<void> => {
    // todo check
    req.event.timestamp = new Date(Date.now());
    return await ExecutionDAL.addExecutionEvent(req);
}


export const getExecutionHistory = async (req: GetExecutionHistoryInput): Promise<HistoryEvent[]> => {
    // todo
    ArnHelper.ensureIsValidExecutionArn(req.executionArn);
    const events = await ExecutionDAL.getExecutionEvent({...req, limit: 1000, offset: 0});
    if (events) {
        const execution = await describeExecution(req);
        const stateMachine = await StateMachineService.describeStateMachine(execution);
    
        putPreviousEventId(stateMachine.definition, events);
    }


    return events;
}

const putPreviousEventId = (definition: IStateMachineDefinition, events: HistoryEvent[]): void => {
    events.find(x => x.type === 'ExecutionStarted').previousEventId = 0;
    const lastEventId = putPreviousEventIdRecursionHelper(definition, events, 0, definition.StartAt);
    const lastEvent = events.find(x => x.type === 'ExecutionSucceeded');
    if (lastEvent) {
        lastEvent.previousEventId = lastEventId;
    } else {
        const failedEvent = events.find(x => x.type.startsWith('Execution') && x.type !== 'ExecutionStarted');
        failedEvent != null ? failedEvent.previousEventId = 0 : false
    }
}

const putPreviousEventIdRecursionHelper = (definition: IStateMachineDefinition, events: HistoryEvent[], 
                                           lastEventId: number, stateName: string): number => {

    const currentState = definition.States[stateName];
    const currentStateEnteredEvent = events.find(x => x.stateEnteredEventDetails?.name === stateName);
    if (currentStateEnteredEvent == null) {
        return;
    }
    currentStateEnteredEvent.previousEventId = lastEventId;
    lastEventId = currentStateEnteredEvent.id;
    if (currentState.Type === StateType.Parallel) {
        const currentParallel = currentState as ParallelState;
        for(const branche of currentParallel.Branches) {
            const lastEventIdOfBranch = putPreviousEventIdRecursionHelper(branche, events, lastEventId, branche.StartAt);
            lastEventId = lastEventIdOfBranch > lastEventId ? lastEventIdOfBranch: lastEventId;
        }
    } else if (currentState.Type === StateType.Task) {
        lastEventId = putPreviousEventIdsForTaskStateHelper(events, lastEventId);
    }
    const currentStateExitedEvent = events.find(x => x.stateExitedEventDetails?.name === stateName);
    if (currentStateExitedEvent) {
        currentStateExitedEvent.previousEventId = lastEventId;
        lastEventId = currentStateExitedEvent.id;
        if ((currentState as PassState).Next) {
            lastEventId = putPreviousEventIdRecursionHelper(definition, events, lastEventId, (currentState as PassState).Next)
        }
    }
    return lastEventId;
}

const putPreviousEventIdsForTaskStateHelper = (events: HistoryEvent[], lastEventId: number): number => {
    const activityScheduled = events.find(x => x.type === HistoryEventType.ActivityScheduled);
    if (activityScheduled) {
        activityScheduled.previousEventId = lastEventId;
        lastEventId = activityScheduled.id;
        const activityScheduleFailed = events.find(x => x.type === HistoryEventType.ActivityScheduleFailed);
        if (activityScheduleFailed) {
            activityScheduleFailed.previousEventId = lastEventId;
            lastEventId = activityScheduleFailed.id
        } else {
            const activityStarted = events.find(x => x.type === HistoryEventType.ActivityStarted);
            activityStarted.previousEventId = lastEventId;
            lastEventId = activityStarted.id;

            const activityFinished = events.find(x => x.type === HistoryEventType.ActivitySucceeded || x.type === HistoryEventType.ActivityTimedOut);
            activityFinished.previousEventId = lastEventId;
            lastEventId = activityFinished.id;
        }
    }

    return lastEventId;
}
