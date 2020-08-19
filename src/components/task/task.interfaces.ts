import { StateMachineState } from "../stateMachines/stateMachine.interfaces";

export interface Task {
    execution: string,
    state: StateMachineState
}