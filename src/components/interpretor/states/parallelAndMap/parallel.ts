import { StateMachineService } from "@App/components/stateMachines";
import { ParallelState, StateType } from "@App/components/stateMachines/stateMachine.interfaces";
import { RunningParallelMapState, RunningState } from "@App/components/interpretor/interpretor.interfaces";
import { Logger } from "@App/modules";
import { InterpretorService } from "../..";
import * as ParallelDAL from './parallelAndMapDAL'
import { onParallelStateSucceeded, onParallelTaskStarted, onTaskStateAborted, onWaitStateAborted } from "../../historyEvent";
import { endStateFailed, endStateSuccess, filterInput, filterOutput } from "../../stateProcessing";
import { abortTaskState } from "../task/task";
import { HandleFinishedParallelBrancheEventInput } from "@App/components/events";

export const processParallelState = async (req: {task: RunningState, state: ParallelState}): Promise<void> => {
    const {task, state} = req;
    task.previousEventId = await onParallelTaskStarted(task)

    const effectiveInput = await filterInput(task, state);
    Logger.logDebug(`setting parallel state info  of state '${task.stateName}' of execution '${task.executionArn}' with key '${task.token}'`)
    
    const stateInfo: RunningParallelMapState = {...task, numberOfBranchesLeft: state.Branches.length, output: new Array(state.Branches.length).fill(null) }
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
            parentInfo: {
                parentKey: task.token,
                currentBranche: i,
                type: StateType.Parallel
            } 
        });
    }
    Logger.logDebug(`Branches added for state '${req.task.stateName}' of execution '${task.executionArn}'`)
}

export const handleFinishedBranche = async (req: HandleFinishedParallelBrancheEventInput): Promise<void> => {
    Logger.logDebug(`finished branches number '${req.brancheIndex}' of parallel state key '${req.token}'`)
    
    const executionWasAborted = await InterpretorService.getStateInfo(req.token, StateType.Parallel) == null;
    if (executionWasAborted) {
        return;
    }

    const numberOfBrancheLeft = await ParallelDAL.updateRunningStateInfo({brancheNumber: req.brancheIndex, 
        output: JSON.stringify(req.output), parallelStateKey: req.token, stateType: StateType.Parallel});
    if (numberOfBrancheLeft === 0) {
        const task = await InterpretorService.getStateInfo(req.token, StateType.Parallel) as RunningParallelMapState;
        const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: task.stateMachineArn, stateName: task.stateName}) as ParallelState;
        task.previousEventId = await onParallelStateSucceeded({executionArn: task.executionArn, previousEventId: req.previousEventId})
        const effectiveOutput = await filterOutput(task.rawInput, task.output, state, task);
        await endStateSuccess({stateInfo: {...task, previousEventId: req.previousEventId}, nextStateName: state.Next, output: effectiveOutput})
        await InterpretorService.deleteStateInfo(task);
    }
}

export const handleFailedBranche = async (req: {cause?: string, error?: string, parallelStateKey: string, previousEventId: number, failedState: RunningState}): Promise<void> => {
    const executionWasAborted = await InterpretorService.getStateInfo(req.parallelStateKey, StateType.Parallel) == null;
    if (executionWasAborted) {
        return;
    }

    const task = await InterpretorService.getStateInfo(req.parallelStateKey, StateType.Parallel) as RunningParallelMapState;
    await abortRunningStates({...task, parallelStateToken: req.parallelStateKey, previousEventId: req.previousEventId, failedState: req.failedState});

    await InterpretorService.deleteStateInfo(task)
    task.previousEventId = req.previousEventId
    const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: task.stateMachineArn, stateName: task.stateName}) as ParallelState;
    await endStateFailed({stateInfo: task, cause: req.cause, error: req.error, state})
}

const abortRunningStates = async (req: {parallelStateToken: string, previousEventId: number, executionArn: string, failedState: RunningState}): Promise<void> => {
    const runningStateToken = await ParallelDAL.getRunningStateInside(req.parallelStateToken);

    if (req.failedState.stateType === StateType.Task) {
        await onTaskStateAborted(req)
    } else if (req.failedState.stateType === StateType.Wait){
        await onWaitStateAborted(req);
    }

    for (const taskToken of runningStateToken.tasks) {
        await abortTaskState(taskToken);
        await onTaskStateAborted(req)
    }
    
    for (const waitToken of runningStateToken.wait) {
        await onWaitStateAborted(req);
    }
};

export const isParallelStateStillRunning = async (parallelStateKey: string): Promise<boolean> => {
    const task = await InterpretorService.getStateInfo(parallelStateKey, StateType.Parallel) 
    return task != null;
}
