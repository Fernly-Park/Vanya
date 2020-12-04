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
import { handleFailedBranche, handleFinishedBranche } from "./states/parallel/parallel";
import { ContextObjectService } from "../contextObject";

export const filterInput = async (task: RunningState, state: StateMachineStateValue): Promise<StateInput> => {
    const asPassState = state as PassState;
    let toReturn = applyPath(task.rawInput, asPassState.InputPath);
    const contextObject = await ContextObjectService.describeContextObject(task);
    toReturn = await applyPayloadTemplate(contextObject, toReturn, asPassState.Parameters)
    return toReturn;
}

export const filterOutput = async (rawInput: StateInput, output: StateOutput, state: StateMachineStateValue, task: RunningState): Promise<StateOutput> => {
    const asTaskState = state as TaskState;
    const contextObject = await ContextObjectService.describeContextObject(task);
    let toReturn = applyPayloadTemplate(contextObject, output, asTaskState.ResultSelector)
    toReturn = applyResultPath(rawInput, toReturn, asTaskState.ResultPath);
    toReturn = applyPath(toReturn, asTaskState.OutputPath);
    return toReturn;
};

export const isExecutionStillRunning = async (executionArn: string): Promise<boolean> => {
    const executionStatus = await InterpretorDAL.getExecutionStatus(executionArn)
    return executionStatus === ExecutionStatus.running;
}

export const endStateSuccess = async (req: {stateInfo: RunningState, nextStateName: string, output: StateOutput}): Promise<void> => {
    const {stateInfo, nextStateName, output} = req;
    Logger.logDebug(`State '${stateInfo.stateName}' of '${stateInfo.executionArn}' finished successfully. stringified effective output : '${JSON.stringify(req.output)}'`)
    if (!await isExecutionStillRunning(stateInfo.executionArn)) {
        return;
    }

    stateInfo.previousEventId = await onStateExitedEvent({...stateInfo, stateType: stateInfo.stateType, output});
    if (nextStateName) {
        return await execute({executionArn: stateInfo.executionArn, stateName: nextStateName, 
            rawInput: req.output, stateMachineArn: stateInfo.stateMachineArn, previousStateName: stateInfo.stateName, previousEventId: stateInfo.previousEventId,
            parallelInfo: stateInfo.parallelInfo})
    } else {
        if (stateInfo.parallelInfo) {
            return handleFinishedBranche({output: req.output, brancheIndex: stateInfo.parallelInfo.currentBranche, 
                parallelStateKey: stateInfo.parallelInfo.parentKey, previousEventId: stateInfo.previousEventId})
        }
        await onExecutionSucceededEvent({result: req.output, executionArn: stateInfo.executionArn, previousEventId: stateInfo.previousEventId});
        await ExecutionService.endExecution({executionArn: stateInfo.executionArn, output: req.output, status: ExecutionStatus.succeeded});
    }   
}

export const endStateFailed = async (req: {stateInfo: RunningState, cause?: string, error?: string, state: StateMachineStateValue}): Promise<void> => {
    Logger.logDebug(`State from '${req.stateInfo.stateName}' from '${req.stateInfo.executionArn}' failed, handling error`)
    if (!await isExecutionStillRunning(req.stateInfo.executionArn)) {
        return;
    }
    let wasTheErrorHandled = await handleRetry(req);
    if (!wasTheErrorHandled) {
        wasTheErrorHandled = await handleCatch(req)
    }

    if (!wasTheErrorHandled) {

        if (req.stateInfo.parallelInfo && req.error !== AWSConstant.error.STATE_RUNTIME) {

            await handleFailedBranche({cause: req.cause, error: req.error, parallelStateKey: req.stateInfo.parallelInfo.parentKey, 
                previousEventId: req.stateInfo.previousEventId, failedState: req.stateInfo})

        } else {
            Logger.logDebug(`State from '${req.stateInfo.stateName}' from '${req.stateInfo.executionArn}', causing execution to fail`)
            await InterpretorDAL.deleteRunningStatesInfo(req.stateInfo.executionArn);
            await onExecutionFailedEvent({...req.stateInfo, cause: req.cause, error: req.error});
            await ExecutionService.endExecution({executionArn: req.stateInfo.executionArn, status: ExecutionStatus.failed})
        }
    }
}


