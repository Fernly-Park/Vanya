import { dummyActivityArn, dummyExecutionArn, dummyStateMachineArn } from '@Tests/testHelper';
import { ActivityDoesNotExistError, InvalidArnError, InvalidNameError, InvalidOutputError, InvalidTokenError, TaskDoesNotExistError } from '@App/errors/AWSErrors';
import { generateServiceTest } from '@Tests/testGenerator';
import config from '@App/config';
import { ActivityTask } from './task.interfaces';
import { StateType } from '../stateMachines/stateMachine.interfaces';
import * as Event from '../events';
import { taskOutputMaxLength, taskTokenMaxLength } from '@App/components/task/taskService';
import { TaskService } from '.';
import { ActivityService } from '../activity';

generateServiceTest({describeText: 'tasks', tests: (getUser) => {
    const activityTask: ActivityTask = {token: 'token', input: {hello: 'world'}, Type: StateType.Pass, executionArn: dummyExecutionArn, 
    stateName: 'HelloWorld', stateMachineArn: dummyStateMachineArn, Resource: dummyActivityArn};

    const createAndGetActivityTaskHelper = async (req?: {input?: Record<string, unknown>, token?: string}) => {
        const activity = await ActivityService.createActivity(getUser().id, 'tmp');
        const input: ActivityTask = {...activityTask, token: req?.token ?? 'token', input: req?.input ?? {hello: 'world'}, Resource: activity.activityArn};
        await TaskService.addActivityTask(activity.activityArn, input);
        const result = await TaskService.getActivityTask(activity);
        return {
            activity,
            result
        }
    };

    describe('get activit task', () => {
        it('should work', async () => {
            expect.assertions(2);

            const input = {hello: 'world'};
            const token = 'token';
            const {result} = await createAndGetActivityTaskHelper({input, token})
            expect(JSON.parse(result.input)).toStrictEqual(input);
            expect(result.taskToken).toBe(token);
        });

        it('should wait 1 seconds and send null when there is task in the queue', async () => {
            expect.assertions(3);

            const before = new Date();
            const activity = await ActivityService.createActivity(getUser().id, 'tmp');
            const result = await TaskService.getActivityTask(activity);
            const after = new Date();

            const durationInSeconds = (after.getTime() - before.getTime()) / 1000;
            expect(Math.round(durationInSeconds)).toBe(config.activityTaskDefaultTimeout)
            expect(result.input).toBeNull();
            expect(result.taskToken).toBeNull();
        });

        it('should be giving a task only once', async () => {
            expect.assertions(2);

            const input = {hello: 'world'};
            const activity = await ActivityService.createActivity(getUser().id, 'tmp');
            await TaskService.addActivityTask(activity.activityArn, {...activityTask, input, token: 'token'});
            const first = await TaskService.getActivityTask(activity);
            const second = await TaskService.getActivityTask(activity);

            expect(JSON.parse(first.input)).toStrictEqual(input);
            expect(second.input).toBeNull();
        });

        it('should only be giving a task belonging to the correct activity', async () => {
            expect.assertions(4);

            const firstInput = {good: 'good'};
            const secondInput = {bad: 'bad'}
            const firstActivity = await ActivityService.createActivity(getUser().id, 'first');
            const secondActivity = await ActivityService.createActivity(getUser().id, 'second');
            const before = new Date();
            await TaskService.addActivityTask(firstActivity.activityArn, {...activityTask, input: firstInput, token: 'token'});
            await TaskService.addActivityTask(secondActivity.activityArn, {...activityTask, token: 'token', input: secondInput});
            
            const firstActivityTask1 = await TaskService.getActivityTask(firstActivity);
            const firstActivityTask2 = await TaskService.getActivityTask(firstActivity);

            expect(JSON.parse(firstActivityTask1.input)).toStrictEqual(firstInput);
            expect(firstActivityTask2.input).toBeNull();

            const secondActivityTask = await TaskService.getActivityTask(secondActivity);
            const after = new Date();
            const durationInSeconds = (after.getTime() - before.getTime()) / 1000;
            expect(JSON.parse(secondActivityTask.input)).toStrictEqual(secondInput);
            expect(Math.round(durationInSeconds)).toBe(config.activityTaskDefaultTimeout)
        });
        
        it('should fail if the activity arn does not exists', async () => {
            expect.assertions(1);

            await expect(TaskService.getActivityTask({activityArn: dummyActivityArn})).rejects.toThrow(ActivityDoesNotExistError)
        });

        it('should fail if the activity arn is invalid', async () => {
            expect.assertions(1);

            await expect(TaskService.getActivityTask({activityArn: 'hello'})).rejects.toThrow(InvalidArnError);
        });
        
        it.each(['', 'a'.repeat(81), 81])("should fail if the worker name is '%p'", async (workerName: string) => {
            expect.assertions(1);
            const activity = await ActivityService.createActivity(getUser().id, 'tmp');
            await expect(TaskService.getActivityTask({workerName, activityArn: activity.activityArn})).rejects.toThrow(InvalidNameError);
        });
    });

    describe('send task success', () => {

        it('should work', async () => {
            expect.assertions(1);
            
            let wasCalled = false;
            Event.on(Event.CustomEvents.ActivityTaskSucceeded, () => {
                wasCalled = true;
                return Promise.resolve()
            })
            
            const {result} = await createAndGetActivityTaskHelper()
            await TaskService.sendTaskSuccess({taskToken: result.taskToken, output: '{}'});

            expect(wasCalled).toBe(true);
        });

        it('should throw if the token does not exists', async () => {
            expect.assertions(1);

            await expect(TaskService.sendTaskSuccess({taskToken: 'hello', output: '{}'})).rejects.toThrow(TaskDoesNotExistError);
        });

        it.each(['', null, '{', 'hello', 82, undefined])("should fail if the output is '%p'", async (output: string) => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(TaskService.sendTaskSuccess({taskToken: result.taskToken, output})).rejects.toThrow(InvalidOutputError);
        });

        it('shoud fail if the output length is too big', async () => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(TaskService.sendTaskSuccess({taskToken: result.taskToken, output: `{"a": ${'a'.repeat(taskOutputMaxLength)}}`})).rejects.toThrow(InvalidOutputError);
        });

        it('should fail if the task token is too big', async () => {
            expect.assertions(1);            
            
            await expect(TaskService.sendTaskSuccess({taskToken: 'a'.repeat(taskTokenMaxLength+1), output: '{}'})).rejects.toThrow(InvalidTokenError);
        })
        it.each(['', 82, null, undefined, {}])("should fail if the taskToken is '%p'", async (taskToken: string) => {
            expect.assertions(1);            
            
            await expect(TaskService.sendTaskSuccess({taskToken, output: '{}'})).rejects.toThrow(InvalidTokenError);
        });
    });
}});

