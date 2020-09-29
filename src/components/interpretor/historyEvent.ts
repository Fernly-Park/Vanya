import * as ExecutionService from '@App/components/execution/executionService';
import { Task } from '../task/task.interfaces';
import { AWSConstant } from '@App/utils/constants';
import { StateType, TaskState } from '../stateMachines/stateMachine.interfaces';

export enum InterpretorEvents {
    ActivityScheduled = 'ActivityScheduled',
    ActivityStarted = 'ActivityStarted',
    ActivitySucceeded = 'ActivitySucceeded'
}

export const addStateEnteredEvent = async (task: Task, stateType: StateType): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: task.executionArn, event: {
        previousEventId: task.previousEventId,
        type: `${stateType}StateEntered`, 
        stateEnteredEventDetails: {
            name: task.stateName,
            input: JSON.stringify(task.input),
    }}});
}

export const addActivityScheduledEvent = async (task: Task, state: TaskState, resource: string): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: task.executionArn, event: {
        type: 'ActivityScheduled',
        previousEventId: task.previousEventId,
        activityScheduledEventDetails: {
            resource: resource,
            heartbeatInSeconds: state.HeartbeatSeconds,
            input: JSON.stringify(task.input),
            timeoutInSeconds: state.TimeoutSeconds
        }
    }})
}

export const addActivityStartedEvent = async (req: {executionArn: string, previousEventId: number, workerName?: string}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: 'ActivityStarted',
        previousEventId: req.previousEventId,
        activityStartedEventDetails: {
            workerName: req.workerName
        }
    }});
}

export const addStateExistedEvent = async (req: {executionArn: string, previousEventId: number, stateName: string, output: unknown, stateType: StateType}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: { previousEventId: req.previousEventId,
        type: `${req.stateType}StateExited`,
        stateExitedEventDetails: {
            name: req.stateName,
            output: JSON.stringify(req.output)
        }
    }})
}

export const addExecutionFailedEvent = async (req: {executionArn: string, stateName: string, previousEventId: number, description: string}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        previousEventId: req.previousEventId,
        type: 'ExecutionFailed',
        executionFailedEventDetails: {
            cause: `An error occurred while executing the state '${req.stateName}'. ${req.description}`,
            error: AWSConstant.error.STATE_RUNTIME
        }
    }});
}

export const addExecutionSucceededEvent = async (req: {executionArn: string, previousEventId: number, result: unknown}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        previousEventId: req.previousEventId,
        type: 'ExecutionSucceeded',
        executionSucceededEventDetails: {
            output: JSON.stringify(req.result),
        }
    }});
}