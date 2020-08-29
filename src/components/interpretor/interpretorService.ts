import * as TaskService from '../task/taskService';
import * as ExecutionService from '@App/components/execution/executionService';
import { Task } from '../task/task.interfaces';
import { PassState } from '@App/components/stateMachines/stateMachine.interfaces';

let interpreter = true;
export const startInterpretor = async (): Promise<void> => {
    // eslint-disable-next-line no-constant-condition
    interpreter = true;
    while(interpreter) {
        const task = await TaskService.getGeneralTask();
        await processTask(task);
    }    
};

const processTask = async (task: Task): Promise<void> => {
    let result: string;
    let next: string;
    switch (task.state.Type) {
        default: 
            result = processPassTask(task)
            next = (task.state as PassState).Next
            break;
    }

    if (next) {
        // TODO
        console.log('todo');
    } else {
        await ExecutionService.endExecution(task.executionArn);
    }   
};

const processPassTask = (task: Task): string => {
    const passState = task.state as PassState;
    console.log('passState : ', passState);
    return JSON.stringify(passState.Result) ?? task.input // pass it's input to it's output. todo : input and outputPath
}

export const stopInterpreter = (): void => {
    interpreter = false;
}