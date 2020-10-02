import { TaskState } from "@App/components/stateMachines/stateMachine.interfaces";
import { ActivityTask, StateInput, Task } from "@App/components/task/task.interfaces";
import { TaskResourceDoesNotExistsError } from "@App/errors/customErrors";
import * as Event from '@App/components/events';
import { applyPath } from "../path";
import { ExecutionService } from "@App/components/execution";
import { endStateExecution } from "../interpretorService";
import { ExecutionStatus } from "@App/components/execution/execution.interfaces";
import { TaskService } from "@App/components/task";
import { ActivityService } from "@App/components/activity";

export const processTaskState = async (task: Task, state: TaskState, effectiveInput: StateInput, token: string): Promise<void> => {
    const resource = state.Resource;
    const activity = await ActivityService.getActivity(resource);
    if (!activity) {
        throw new TaskResourceDoesNotExistsError(`The activity ${resource} does not exist.`);
    }
    await TaskService.addActivityTask(resource, {...task, ...state, input: effectiveInput, token});
    await Event.activityScheduledEvent.emit({executionArn: task.executionArn, resource, heartbeatSeconds: state.HeartbeatSeconds, 
        input: effectiveInput, timeoutSeconds: state.TimeoutSeconds});
}

export const processTaskStateDone = async (activityTask: ActivityTask): Promise<void> => {
    // outputPath
    try {
        const output = applyPath(activityTask.output, activityTask.OutputPath);
        await Event.activitySucceededEvent.emit({executionArn: activityTask.executionArn, output})
        await endStateExecution({...activityTask, output, nextStateName: activityTask.Next, stateType: activityTask.Type})
    } catch (err) {
        await Event.executionFailedEvent.emit({...activityTask, description: (err as Error)?.message})
        return await ExecutionService.endExecution({executionArn: activityTask.executionArn, status: ExecutionStatus.failed})
    }
}