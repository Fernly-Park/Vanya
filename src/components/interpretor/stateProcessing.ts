import { ExecutionService } from "@App/components/execution";
import { StateMachineStateValue, PassState, TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { Logger } from "@App/modules";
import { AWSConstant } from "@App/utils/constants";
import { InterpretorDAL } from ".";
import { ExecutionStatus } from "../execution/execution.interfaces";
import { onStateExitedEvent, onExecutionSucceededEvent, onExecutionFailedEvent } from "./historyEvent";
import { RunningState, StateInput, StateOutput } from "./interpretor.interfaces";
import { execute } from "./interpretorService";
import { applyPath, applyPayloadTemplate, applyResultPath } from "./path/path";
import { handleCatch, handleRetry } from "./states/catchAndRetry";
import { handleFailedBranche, handleFinishedBranche } from "./states/parallel";

export const filterInput = async (task: RunningState, state: StateMachineStateValue): Promise<StateInput> => {
    const asPassState = state as PassState;
    let toReturn = applyPath(task.rawInput, asPassState.InputPath);
    const contextObject = await ExecutionService.retrieveExecutionContextObject(task);
    toReturn = await applyPayloadTemplate(contextObject, toReturn, asPassState.Parameters)
    return toReturn;
}

export const filterOutput = async (rawInput: StateInput, output: StateOutput, state: StateMachineStateValue, task: RunningState): Promise<StateOutput> => {
    const asTaskState = state as TaskState;
    const contextObject = await ExecutionService.retrieveExecutionContextObject(task);
    let toReturn = applyPayloadTemplate(contextObject, output, asTaskState.ResultSelector)
    toReturn = applyResultPath(rawInput, toReturn, asTaskState.ResultPath);
    toReturn = applyPath(toReturn, asTaskState.OutputPath);
    return toReturn;
};

export const isExecutionStillRunning = async (executionArn: string): Promise<boolean> => {
    const executionStatus = await InterpretorDAL.getExecutionStatus(executionArn)
    return executionStatus === ExecutionStatus.running;
}

export const endStateSuccess = async (req: RunningState & {nextStateName: string, output: StateOutput, state: StateMachineStateValue}): Promise<void> => {
    Logger.logDebug(`State '${req.stateName}' of '${req.executionArn}' finished successfully. stringified effective output : '${JSON.stringify(req.output)}'`)
    if (!await isExecutionStillRunning(req.executionArn)) {
        return;
    }
    req.previousEventId = await onStateExitedEvent({...req, stateType: req.state.Type});
    if (req.nextStateName) {
        return await execute({executionArn: req.executionArn, stateName: req.nextStateName, 
            rawInput: req.output, stateMachineArn: req.stateMachineArn, previousStateName: req.stateName, previousEventId: req.previousEventId,
            parallelInfo: req.parallelInfo})
    } else {
        if (req.parallelInfo) {
            return handleFinishedBranche({output: req.output, brancheIndex: req.parallelInfo.currentBranche, 
                parallelStateKey: req.parallelInfo.parentKey, previousEventId: req.previousEventId})
        }
        await onExecutionSucceededEvent({result: req.output, executionArn: req.executionArn, previousEventId: req.previousEventId});
        await ExecutionService.endExecution({executionArn: req.executionArn, output: req.output, status: ExecutionStatus.succeeded});
    }   
}

export const endStateFailed = async (req: {task: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<void> => {
    Logger.logDebug(`State from '${req.task.stateName}' from '${req.task.executionArn}' failed, handling error`)
    if (!await isExecutionStillRunning(req.task.executionArn)) {
        return;
    }
    let wasTheErrorHandled = await handleRetry(req);
    if (!wasTheErrorHandled) {
        wasTheErrorHandled = await handleCatch(req)
    }

    if (!wasTheErrorHandled) {
        if (req.task.parallelInfo && req.error !== AWSConstant.error.STATE_RUNTIME) {
            return await handleFailedBranche({cause: req.cause, error: req.error, parallelStateKey: req.task.parallelInfo.parentKey, 
                previousEventId: req.task.previousEventId})
        } else {
            Logger.logDebug(`State from '${req.task.stateName}' from '${req.task.executionArn}', causing execution to fail`)
            await cleanFailedState(req);
            await onExecutionFailedEvent({...req.task, cause: req.cause, error: req.error});
            return await ExecutionService.endExecution({executionArn: req.task.executionArn, status: ExecutionStatus.failed})
        }
    }
}

export const cleanFailedState = async (req: {task: RunningState}) : Promise<void> => {
    const {task} = req
    if (task.parallelInfo) {
        await InterpretorDAL.deleteRunningParallelStateInfo(task.parallelInfo.parentKey);
    }
}
