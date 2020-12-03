import { StateMachineService } from "@App/components/stateMachines";
import { ParallelState, StateType } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningParallelState, RunningState, StateOutput } from "@App/components/interpretor/interpretor.interfaces";
import { Logger } from "@App/modules";
import { InterpretorService } from "../..";
import * as ParallelDAL from './parallelDAL'
import { onParallelStateFailed, onParallelStateSucceeded, onParallelTaskStarted, onTaskStateAborted, onWaitStateAborted } from "../../historyEvent";
import { endStateFailed, endStateSuccess, filterInput, filterOutput } from "../../stateProcessing";
import { abortTaskState } from "../task/task";

export const processParallelState = async (req: {task: RunningState, state: ParallelState}): Promise<void> => {
    const {task, state} = req;
    task.previousEventId = await onParallelTaskStarted(task)

    const effectiveInput = await filterInput(task, state);
    Logger.logDebug(`setting parallel state info  of state '${task.stateName}' of execution '${task.executionArn}' with key '${task.token}'`)
    
    const stateInfo: RunningParallelState = {...task, numberOfBranchesLeft: state.Branches.length, output: new Array(state.Branches.length).fill(null) }
    await InterpretorService.saveStateInfo(stateInfo)

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
                parentKey: task.token,
                currentBranche: i
            } 
        });
    }
    Logger.logDebug(`Branches added for state '${req.task.stateName}' of execution '${task.executionArn}'`)
}

export const handleFinishedBranche = async (req: {brancheIndex: number, output: StateOutput, parallelStateKey: string, previousEventId: number}): Promise<void> => {
    Logger.logDebug(`finished branches number '${req.brancheIndex}' of parallel state key '${req.parallelStateKey}'`)
    
    const executionWasAborted = await InterpretorService.getStateInfo(req.parallelStateKey, StateType.Parallel) == null;
    if (executionWasAborted) {
        return;
    }

    const numberOfBrancheLeft = await ParallelDAL.updateRunningParallelStateInfo({brancheNumber: req.brancheIndex, 
        output: JSON.stringify(req.output), parallelStateKey: req.parallelStateKey});
    if (numberOfBrancheLeft === 0) {
        const task = await InterpretorService.getStateInfo(req.parallelStateKey, StateType.Parallel) as RunningParallelState;
        await InterpretorService.deleteStateInfo(req.parallelStateKey, StateType.Parallel);
        const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: task.stateMachineArn, stateName: task.stateName}) as ParallelState;
        const effectiveOutput = await filterOutput(task.rawInput, task.output, state, task);
        await onParallelStateSucceeded({executionArn: task.executionArn, previousEventId: req.previousEventId})
        await endStateSuccess({...task, state, nextStateName: state.Next, output: effectiveOutput, previousEventId: req.previousEventId})
    }
}

export const handleFailedBranche = async (req: {cause?: string, error?: string, parallelStateKey: string, previousEventId: number}): Promise<void> => {
    const executionWasAborted = await InterpretorService.getStateInfo(req.parallelStateKey, StateType.Parallel) == null;
    if (executionWasAborted) {
        return;
    }
    
    const task = await InterpretorService.getStateInfo(req.parallelStateKey, StateType.Parallel) as RunningParallelState;
    await abortRunningStates({...task, parallelStateToken: req.parallelStateKey, previousEventId: req.previousEventId});

    await InterpretorService.deleteStateInfo(req.parallelStateKey, StateType.Parallel)
    task.previousEventId = await onParallelStateFailed({executionArn: task.executionArn, previousEventId: req.previousEventId})
    const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: task.stateMachineArn, stateName: task.stateName}) as ParallelState;
    await endStateFailed({task, cause: req.cause, error: req.error, state})
}

const abortRunningStates = async (req: {parallelStateToken: string, previousEventId: number, executionArn: string}): Promise<void> => {
    const runningStateToken = await ParallelDAL.getRunningStateInsideParallel(req.parallelStateToken);

    for (const taskToken of runningStateToken.tasks) {
        await abortTaskState(taskToken);
        await onTaskStateAborted(req)
    }
    
    for (const waitToken of runningStateToken.wait) {
        const waitInfo = await InterpretorService.getStateInfo(waitToken, StateType.Wait);
        await InterpretorService.removeFromCurrentlyRunningState(waitInfo);
        await onWaitStateAborted(req);
    }
};

export const isParallelStateStillRunning = async (parallelStateKey: string): Promise<boolean> => {
    const task = await InterpretorService.getStateInfo(parallelStateKey, StateType.Parallel) 
    return task != null;
}
