import { TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { StateInput, Task } from "@App/components/task/task.interfaces";
import * as TaskService from '@App/components/task/taskService';
import * as ActivityService from '@App/components/activity/activityService';
import { TaskResourceDoesNotExistsError } from "@App/errors/customErrors";
import { addActivityScheduledEvent } from "../historyEvent";

export const processTaskState = async (task: Task, state: TaskState, effectiveInput: StateInput, token: string): Promise<void> => {
    const resource = state.Resource;
    const activity = await ActivityService.getActivity(resource);
    if (!activity) {
        throw new TaskResourceDoesNotExistsError(`The activity ${resource} does not exist.`);
    }
    await TaskService.addActivityTask(resource, {...task, ...state, input: effectiveInput, token});
    await addActivityScheduledEvent(task, state, resource);
}