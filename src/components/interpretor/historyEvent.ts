import * as ExecutionService from '@App/components/execution/executionService';
import { Task } from '../task/task.interfaces';
import { AWSConstant } from '@App/utils/constants';
import { StateType, TaskState } from '../stateMachines/stateMachine.interfaces';

export enum InterpretorEvents {
    ActivityScheduled = 'ActivityScheduled',
    ActivityStarted = 'ActivityStarted',
    ActivitySucceeded = 'ActivitySucceeded'
}

export const addStateEnteredEvent = async (task: Task, stateType: StateType): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: task.executionArn, event: {
        type: `${stateType}StateEntered`, 
        stateEnteredEventDetails: {
            name: task.stateName,
            input: JSON.stringify(task.input),
    }}});
}

export const addActivityScheduledEvent = async (task: Task, state: TaskState, resource: string): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: task.executionArn, event: {
        type: 'ActivityScheduled',
        activityScheduledEventDetails: {
            resource: resource,
            heartbeatInSeconds: state.HeartbeatSeconds,
            input: JSON.stringify(task.input),
            timeoutInSeconds: state.TimeoutSeconds
        }
    }});
}

export const addActivityStartedEvent = async (req: {executionArn: string, workerName?: string}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: 'ActivityStarted',
        activityStartedEventDetails: {
            workerName: req.workerName
        }
    }});
}

export const addActivitySucceededEvent = async (req: {executionArn: string, output: unknown}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event : {
        type: 'ActivitySucceeded',
        activitySucceededEventDetails: {
            output: JSON.stringify(req.output),
        }
    }})
}

export const addStateExistedEvent = async (req: {executionArn: string, stateName: string, output: unknown, stateType: StateType}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: `${req.stateType}StateExited`,
        stateExitedEventDetails: {
            name: req.stateName,
            output: JSON.stringify(req.output)
        }
    }})
}

export const addExecutionFailedEvent = async (req: {executionArn: string, stateName: string, description: string}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: 'ExecutionFailed',
        executionFailedEventDetails: {
            cause: `An error occurred while executing the state '${req.stateName}'. ${req.description}`,
            error: AWSConstant.error.STATE_RUNTIME
        }
    }});
}

export const addExecutionSucceededEvent = async (req: {executionArn: string, result: unknown}): Promise<void> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        type: 'ExecutionSucceeded',
        executionSucceededEventDetails: {
            output: JSON.stringify(req.result),
        }
    }});
}