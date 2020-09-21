import * as ExecutionService from '@App/components/execution/executionService';
import { Task } from '../task/task.interfaces';
import { AWSConstant } from '@App/utils/constants';
import { StateType } from '../stateMachines/stateMachine.interfaces';


export const addStateEnteredEvent = async (task: Task, stateType: StateType): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: task.executionArn, event: {
        previousEventId: task.previousEventId,
        type: `${stateType}StateEntered`, 
        stateEnteredEventDetails: {
            name: task.stateName,
            input: JSON.stringify(task.input),
    }}});
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

export const addExecutionFailedEvent = async (req: {executionArn: string, stateName: string, previousEventId: number}): Promise<number> => {
    return await ExecutionService.addEvent({executionArn: req.executionArn, event: {
        previousEventId: req.previousEventId,
        type: 'ExecutionFailed',
        executionFailedEventDetails: {
            cause: `An error occurred while executing the state '${req.stateName}'`,
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