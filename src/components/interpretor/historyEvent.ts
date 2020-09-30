import * as ExecutionService from '@App/components/execution/executionService';
import { AWSConstant } from '@App/utils/constants';
import { StateType } from '../stateMachines/stateMachine.interfaces';
import { HistoryEventType } from '../execution/execution.interfaces';
import { ActivityScheduledEventInput, ActivityStartedEventInput, ActivitySucceededEventInput, ExecutionFailedEventInput, ExecutionSucceededEventInput, StateExitedEventInput } from '../events';

export enum InterpretorEvents {
    ActivityScheduled = 'ActivityScheduled',
    ActivityStarted = 'ActivityStarted',
    ActivitySucceeded = 'ActivitySucceeded'
}

export const onStateEnteredEvent = async (req: {executionArn: string, stateName: string, stateType: StateType, input: unknown}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: `${req.stateType}StateEntered` as HistoryEventType, 
        stateEnteredEventDetails: {
            name: req.stateName,
            input: JSON.stringify(req.input),
    }}});
}

export const onActivityScheduledEvent = async (req: ActivityScheduledEventInput): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ActivityScheduled,
        activityScheduledEventDetails: {
            resource: req.resource,
            heartbeatInSeconds: req.heartbeatSeconds,
            input: JSON.stringify(req.input),
            timeoutInSeconds: req.timeoutSeconds
        }
    }});
}

export const onActivityStartedEvent = async (req: ActivityStartedEventInput): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ActivityStarted,
        activityStartedEventDetails: {
            workerName: req.workerName
        }
    }});
}

export const onActivitySucceededEvent = async (req: ActivitySucceededEventInput): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event : {
        type: HistoryEventType.ActivitySucceeded as HistoryEventType,
        activitySucceededEventDetails: {
            output: JSON.stringify(req.output),
        }
    }})
}

export const onStateExitedEvent = async (req: StateExitedEventInput): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: `${req.stateType}StateExited` as HistoryEventType,
        stateExitedEventDetails: {
            name: req.stateName,
            output: JSON.stringify(req.output)
        }
    }})
}

export const onExecutionFailedEvent = async (req: ExecutionFailedEventInput): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ExecutionFailed,
        executionFailedEventDetails: {
            cause: `An error occurred while executing the state '${req.stateName}'. ${req.description}`,
            error: AWSConstant.error.STATE_RUNTIME
        }
    }});
}

export const onExecutionSucceededEvent = async (req: ExecutionSucceededEventInput): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ExecutionSucceeded,
        executionSucceededEventDetails: {
            output: JSON.stringify(req.result),
        }
    }});
}