import { StateMachineService } from "@App/components/stateMachines";
import { MapState, StateType } from "@App/components/stateMachines/stateMachine.interfaces";
import { InvalidInputError, InvalidParameterError } from "@App/errors/customErrors";
import { Logger } from "@App/modules";
import { InterpretorService } from "../..";
import { onMapIterationStarted, onMapIterationSucceeded, onMapStateSucceeded, onMapTaskStarted } from "../../historyEvent";
import { RunningParallelMapState, RunningState, StateOutput } from "../../interpretor.interfaces";
import { applyPath } from "../../path/path";
import { endStateSuccess, filterInput, filterOutput } from "../../stateProcessing";
import * as MapDAL from './parallelAndMapDAL';

export const processMapState = async (input: {stateInfo: RunningState, state: MapState}): Promise<void> => {
    const {stateInfo, state} = input;
    if (input?.stateInfo == null || input?.state == null) {
        throw new InvalidParameterError('Both the stateInfo and the state must be defined to process a map state');
    }

    const effectiveInput = await filterInput(stateInfo, state);
    const items = applyPath(effectiveInput, state.ItemsPath ?? '$') as [];
    if (!Array.isArray(items)) {
        throw new InvalidInputError(`Reference path "${state.ItemsPath}" must point to array`);
    }
    stateInfo.previousEventId = await onMapTaskStarted({...stateInfo, itemLength: items.length})

    const iterator = state.Iterator;

    const mapStateInfo: RunningParallelMapState = {...stateInfo, numberOfBranchesLeft: items.length, output: new Array(items.length).fill(null) }
    await InterpretorService.saveStateInfo(mapStateInfo)

    if (items.length === 0) {
        await endMapStateSuccess({token: stateInfo.token, previousEventId: stateInfo.previousEventId});
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        stateInfo.previousEventId = await onMapIterationStarted({...stateInfo, iterationIndex: i, mapStateName: stateInfo.stateName})
        await InterpretorService.execute({
            executionArn: stateInfo.executionArn,
            previousEventId: stateInfo.previousEventId,
            rawInput: item,
            stateMachineArn: stateInfo.stateMachineArn,
            stateName: iterator.StartAt,
            previousStateName: stateInfo.previousStateName,
            parentInfo: {
                parentKey: stateInfo.token,
                currentBranche: i,
                type: StateType.Map
            } 
        });
    }
}

export const handleFinishedIteration = async (input: {brancheIndex: number, output: StateOutput, token: string, previousEventId: number}): Promise<void> => {
    if (input?.brancheIndex == null || input?.output == null || input?.token == null) {
        throw new InvalidParameterError(`Input needs a branchNumber and an output and a token`);
    }  

    const {brancheIndex, output, token} = input;
    const stateInfo = await InterpretorService.getStateInfo(token, StateType.Map) as RunningParallelMapState
    const previousEventId = await onMapIterationSucceeded({...stateInfo, previousEventId: input.previousEventId, 
        iterationIndex: brancheIndex, mapStateName: stateInfo.stateName})
    const numberOfBrancheLeft = await MapDAL.updateRunningStateInfo({brancheNumber: brancheIndex, 
        output: JSON.stringify(output), parallelStateKey: token, stateType: StateType.Map});

    if (numberOfBrancheLeft === 0) {
        await endMapStateSuccess({token, previousEventId});
    }
}

const endMapStateSuccess = async (input: {token: string, previousEventId: number}): Promise<void> => {
    if (input?.token == null) {
        throw new InvalidParameterError('');
    }
    const {token, previousEventId} = input

    const stateInfo = await InterpretorService.getStateInfo(token, StateType.Map) as RunningParallelMapState;
    const state = await StateMachineService.retrieveStateFromStateMachine({stateMachineArn: stateInfo.stateMachineArn, stateName: stateInfo.stateName}) as MapState;
    stateInfo.previousEventId = await onMapStateSucceeded({...stateInfo, previousEventId});
    const effectiveOutput = await filterOutput(stateInfo.rawInput, stateInfo.output, state, stateInfo);
    await endStateSuccess({stateInfo: {...stateInfo, previousEventId}, nextStateName: state.Next, output: effectiveOutput})
    await InterpretorService.deleteStateInfo(stateInfo);
}