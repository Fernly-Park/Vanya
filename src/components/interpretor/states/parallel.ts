import { StateMachineService } from "@App/components/stateMachines";
import { ParallelState } from "@App/components/stateMachines/stateMachine.interfaces";
import { TaskService } from "@App/components/task";
import { RunningState, StateOutput } from "@App/components/task/task.interfaces";
import { Logger } from "@App/modules";
import { v4 as uuid } from 'uuid';
import { onParallelStateSucceeded, onParallelTaskStarted } from "../historyEvent";
import { endStateSuccess, filterInput, filterOutput } from "../interpretorService";

export const processParallelState = async (req: {task: RunningState, state: ParallelState}): Promise<void> => {
    const {task, state} = req;
    task.previousEventId = await onParallelTaskStarted(task)

    const effectiveInput = await filterInput(task, state);

    const parallelStateKey = uuid();
    Logger.logDebug(`setting parallel state info  of state '${task.stateName}' of execution '${task.executionArn}' with key '${parallelStateKey}'`)
    await TaskService.setRunningParallelStateInfo({parallelStateKey, parallelStateInfo: {...task, numberOfBranchesLeft: state.Branches.length, 
        output: new Array(state.Branches.length).fill(null)}})

    for (let i = 0; i < state.Branches.length; i++) {
        const branche = state.Branches[i];

        await TaskService.addGeneralTask({
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
        })
    }
    Logger.logDebug(`Branches added for state '${req.task.stateName}' of execution '${task.executionArn}'`)
}

export const handleFinishedBranche = async (req: {brancheIndex: number, output: StateOutput, parallelStateKey: string}): Promise<void> => {
    Logger.logDebug(`finished branches number '${req.brancheIndex}' of parallel state key '${req.parallelStateKey}'`)
    const numberOfBrancheLeft = await TaskService.updateRunningParallelStateInfo({brancheNumber: req.brancheIndex, 
        output: JSON.stringify(req.output), parallelStateKey: req.parallelStateKey});
    if (numberOfBrancheLeft === 0) {
        const task = await TaskService.getRunningParallelStateInfo(req.parallelStateKey);
        await TaskService.deleteParallelStateInfo(req.parallelStateKey);
        const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: task.stateMachineArn, stateName: task.stateName}) as ParallelState;
        const effectiveOutput = await filterOutput(task.rawInput, task.output, state, task);
        task.previousEventId = await onParallelStateSucceeded(task)
        await endStateSuccess({...task, state, nextStateName: state.Next, output: effectiveOutput})
    }
}
