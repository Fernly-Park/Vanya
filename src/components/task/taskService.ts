import { Task } from "./task.interfaces";
import * as TaskDAL from "./taskDAL";
import { StateType } from "../stateMachines/stateMachine.interfaces";

export const addTask = async (task: Task): Promise<void> => {
    const { state } = task;
    // todo valider
    switch (state.Type) {
        default : 
            await TaskDAL.addToGeneralTaskQueue(task);
            break;
    }
}