import { StateMachineService } from "@App/components/stateMachines";
import { ParallelState } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningState, StateOutput } from "@App/components/interpretor/interpretor.interfaces";
import { Logger } from "@App/modules";
import { v4 as uuid } from 'uuid';
import { InterpretorService } from "../..";
import * as ParallelDAL from './parallelDAL'
import { onParallelStateFailed, onParallelStateSucceeded, onParallelTaskStarted } from "../../historyEvent";
import { endStateFailed, endStateSuccess, filterInput, filterOutput } from "../../stateProcessing";

export const processParallelState = async (req: {task: RunningState, state: ParallelState}): Promise<void> => {
    const {task, state} = req;
    task.previousEventId = await onParallelTaskStarted(task)

    const effectiveInput = await filterInput(task, state);

    const parallelStateKey = uuid();
    Logger.logDebug(`setting parallel state info  of state '${task.stateName}' of execution '${task.executionArn}' with key '${parallelStateKey}'`)
    await ParallelDAL.setParallelRunningStateInfo({parallelStateKey, parallelStateInfo: {...task, numberOfBranchesLeft: state.Branches.length, 
        output: new Array(state.Branches.length).fill(null)}})

    for (let i = 0; i < state.Branches.length; i++) {
        const branche = state.Branches[i];

        await InterpretorService.execute({
            executionArn: task.executionArn,
            previousEventId: task.previousEventId,
            rawInput: effectiveInput,
            stateMachineArn: task.stateMachineArn,
            stateName: branche.StartAt,
            previousStateName: task.previousStateName,
            parallelInfo: {
                parentKey: parallelStateKey,
                currentBranche: i
            } 
        });
    }
    Logger.logDebug(`Branches added for state '${req.task.stateName}' of execution '${task.executionArn}'`)
}

export const handleFinishedBranche = async (req: {brancheIndex: number, output: StateOutput, parallelStateKey: string, previousEventId: number}): Promise<void> => {
    Logger.logDebug(`finished branches number '${req.brancheIndex}' of parallel state key '${req.parallelStateKey}'`)
    const numberOfBrancheLeft = await ParallelDAL.updateRunningParallelStateInfo({brancheNumber: req.brancheIndex, 
        output: JSON.stringify(req.output), parallelStateKey: req.parallelStateKey});
    if (numberOfBrancheLeft === 0) {
        const task = await ParallelDAL.getRunningParallelStateInfo(req.parallelStateKey);
        await ParallelDAL.deleteRunningParallelStateInfo(req.parallelStateKey);
        const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: task.stateMachineArn, stateName: task.stateName}) as ParallelState;
        const effectiveOutput = await filterOutput(task.rawInput, task.output, state, task);
        await onParallelStateSucceeded({executionArn: task.executionArn, previousEventId: req.previousEventId})
        await endStateSuccess({...task, state, nextStateName: state.Next, output: effectiveOutput, previousEventId: req.previousEventId})
    }
}

export const handleFailedBranche = async (req: {cause?: string, error?: string, parallelStateKey: string, previousEventId: number}): Promise<void> => {
    const task = await ParallelDAL.getRunningParallelStateInfo(req.parallelStateKey);
    await ParallelDAL.deleteRunningParallelStateInfo(req.parallelStateKey);
    task.previousEventId = await onParallelStateFailed({executionArn: task.executionArn, previousEventId: req.previousEventId})
    const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: task.stateMachineArn, stateName: task.stateName}) as ParallelState;
    await endStateFailed({task, cause: req.cause, error: req.error, state})
}
export const isParallelStateStillRunning = async (parallelStateKey: string): Promise<boolean> => {
    const task = await ParallelDAL.getRunningParallelStateInfo(parallelStateKey)
    return !!task;
}
