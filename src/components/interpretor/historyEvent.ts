import { AWSConstant } from '@App/utils/constants';
import { StateType } from '../stateMachines/stateMachine.interfaces';
import { HistoryEventType, IExecution } from '../execution/execution.interfaces';
import { ExecutionService } from '../execution';
import { RunningTaskState } from './interpretor.interfaces';

export enum InterpretorEvents {
    ActivityScheduled = 'ActivityScheduled',
    ActivityStarted = 'ActivityStarted',
    ActivitySucceeded = 'ActivitySucceeded'
}

export const onExecutionStartedEvent = async (req: IExecution): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        previousEventId: 0,
        executionStartedEventDetails: {
            input: JSON.stringify(req.input),
            roleArn: 'todo',
        },
        type: HistoryEventType.ExecutionStarted
    }})
}

export const onStateEnteredEvent = async (req: {executionArn: string, stateName: string, stateType: StateType, input: unknown,
previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: `${req.stateType}StateEntered` as HistoryEventType,
        previousEventId: req.previousEventId,
        stateEnteredEventDetails: {
            name: req.stateName,
            input: JSON.stringify(req.input),
    }}});
}

export const onActivityTimeoutEvent = async (req: {executionArn: string, cause?: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn,
        event: {
            type: HistoryEventType.ActivityTimedOut,
            previousEventId: req.previousEventId,
            activityTimedOutEventDetails: {
                error: AWSConstant.error.STATE_TIMEOUT,
                cause: req.cause
            }
        }
    });
}
export const onActivityScheduledEvent = async (req: {executionArn: string, heartbeatSeconds: number, input: unknown, resource: string, 
    timeoutSeconds: number, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ActivityScheduled,
        previousEventId: req.previousEventId,
        activityScheduledEventDetails: {
            resource: req.resource,
            heartbeatInSeconds: req.heartbeatSeconds,
            input: JSON.stringify(req.input),
            timeoutInSeconds: req.timeoutSeconds
        }
    }});
}

export const onActivityStartedEvent = async (req: {task: RunningTaskState, workerName?: string}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.task.executionArn, event: {
        type: HistoryEventType.ActivityStarted,
        previousEventId: req.task.previousEventId,
        activityStartedEventDetails: {
            workerName: req.workerName
        }
    }});
}

export const onActivitySucceededEvent = async (req: RunningTaskState): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event : {
        previousEventId: req.previousEventId,
        type: HistoryEventType.ActivitySucceeded as HistoryEventType,
        activitySucceededEventDetails: {
            output: JSON.stringify(req.output),
        }
    }})
}

export const onTaskStateAborted = async (req: {executionArn: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        previousEventId: req.previousEventId,
        type: HistoryEventType.TaskStateAborted
    }})
};

export const onStateExitedEvent = async (req: {executionArn: string, stateName: string, output: unknown, stateType: StateType, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: `${req.stateType}StateExited` as HistoryEventType,
        previousEventId: req.previousEventId,
        stateExitedEventDetails: {
            name: req.stateName,
            output: JSON.stringify(req.output)
        }
    }})
}

export const onExecutionFailedEvent = async (req: {executionArn: string, stateName: string, error?: string, cause?: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ExecutionFailed,
        previousEventId: req.previousEventId,
        executionFailedEventDetails: {
            cause: req.cause === null ? undefined : req.cause, 
            error: req.error === null ? undefined : req.error
        }
    }});
}

export const onExecutionAbortedEvent = async (req: {executionArn: string, cause?: string, error?: string}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ExecutionAborted,
        previousEventId: 0,
        executionAbortedEventDetails: {
            cause: req.cause === null ? undefined : req.cause, 
            error: req.error === null ? undefined : req.error
        }
    }});
};
export const onExecutionSucceededEvent = async (req: {executionArn: string, result: unknown, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ExecutionSucceeded,
        previousEventId: req.previousEventId,
        executionSucceededEventDetails: {
            output: JSON.stringify(req.result),
        }
    }});
}

export const onActivityFailedEvent = async (req: {activityTask: RunningTaskState, cause?: string, error?: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.activityTask.executionArn, event: {
        type: HistoryEventType.ActivityFailed,
        previousEventId: req.previousEventId,
        activityFailedEventDetails: {
            cause: req.cause === null ? undefined : req.cause, 
            error: req.error === null ? undefined : req.error
        }
    }});
}

export const onParallelTaskStarted = async (req: {executionArn: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ParallelStateStarted,
        previousEventId: req.previousEventId
    }})
}

export const onParallelStateSucceeded = async (req: {executionArn: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ParallelStateSucceeded,
        previousEventId: req.previousEventId
    }});
}

export const onParallelStateFailed = async (req: {executionArn: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: HistoryEventType.ParallelStateFailed,
        previousEventId: req.previousEventId
    }});
}