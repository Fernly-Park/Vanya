import { StateMachineState } from "../stateMachines/stateMachine.interfaces";

export interface Task {
    state: StateMachineState,
    input: string,
    executionArn: string
}