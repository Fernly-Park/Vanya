import { AWSConstant } from '@App/utils/constants';
import { StateType } from '../stateMachines/stateMachine.interfaces';
import { HistoryEventType } from '../execution/execution.interfaces';
import { ExecutionService } from '../execution';
import { RunningTaskState } from '../task/task.interfaces';

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

export const onActivityTimeoutEvent = async (req: {executionArn: string, cause?: string}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn,
        event: {
            type: HistoryEventType.ActivityTimedOut,
            activityTimedOutEventDetails: {
                error: AWSConstant.error.STATE_TIMEOUT,
                cause: req.cause
            }
        }
    });
}
export const onActivityScheduledEvent = async (req: {executionArn: string, heartbeatSeconds: number, input: unknown, resource: string, timeoutSeconds: number}): Promise<void> => {
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

export const onActivityStartedEvent = async (req: {task: RunningTaskState, workerName?: string}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.task.executionArn, event: {
        type: HistoryEventType.ActivityStarted,
        activityStartedEventDetails: {
            workerName: req.workerName
        }
    }});
}

export const onActivitySucceededEvent = async (req: RunningTaskState): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event : {
        type: HistoryEventType.ActivitySucceeded as HistoryEventType,
        activitySucceededEventDetails: {
            output: JSON.stringify(req.output),
        }
    }})
}

export const onStateExitedEvent = async (req: {executionArn: string, stateName: string, output: unknown, stateType: StateType}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: `${req.stateType}StateExited` as HistoryEventType,
        stateExitedEventDetails: {
            name: req.stateName,
            output: JSON.stringify(req.output)
        }
    }})
}

export const onExecutionFailedEvent = async (req: {executionArn: string, stateName: string, error?: string, cause?: string}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ExecutionFailed,
        executionFailedEventDetails: {
            cause: req.cause === null ? undefined : req.cause, 
            error: req.error === null ? undefined : req.error
        }
    }});
}

export const onExecutionSucceededEvent = async (req: {executionArn: string, result: unknown}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ExecutionSucceeded,
        executionSucceededEventDetails: {
            output: JSON.stringify(req.result),
        }
    }});
}

export const onActivityFailedEvent = async (req: {activityTask: RunningTaskState, cause?: string, error?: string}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.activityTask.executionArn, event: {
        type: HistoryEventType.ActivityFailed,
        activityFailedEventDetails: {
            cause: req.cause === null ? undefined : req.cause, 
            error: req.error === null ? undefined : req.error
        }
    }});
}