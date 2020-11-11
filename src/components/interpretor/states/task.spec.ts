import { dummyActivityArn, dummyExecutionArn, dummyStateMachineArn } from '@Tests/testHelper';
import { ActivityDoesNotExistError, InvalidArnError, InvalidNameError, InvalidOutputError, InvalidParameterTypeError, InvalidTokenError, TaskDoesNotExistError, ValidationExceptionError } from '@App/errors/AWSErrors';
import { generateServiceTest } from '@Tests/testGenerator';
import config from '@App/config';
import { RunningTaskState, ActivityTaskStatus } from '../interpretor.interfaces';
import * as Event from '../../events';
import { ActivityService } from '../../activity';
import { InterpretorDAL, InterpretorService } from '..';
import { taskOutputMaxLength, taskTokenMaxLength } from '@App/utils/validationHelper';

generateServiceTest({describeText: 'tasks', tests: (getUser) => {
    const activityTask: RunningTaskState = {token: 'token', rawInput: {hello: 'world'}, executionArn: dummyExecutionArn, previousEventId: 0,
    stateName: 'HelloWorld', stateMachineArn: dummyStateMachineArn, status: ActivityTaskStatus.Running, effectiveInput: {hello: 'world'}};

    const createAndGetActivityTaskHelper = async (req?: {input?: Record<string, unknown>, token?: string}) => {
        const activity = await ActivityService.createActivity(getUser().id, 'tmp');
        const input: RunningTaskState = {...activityTask, token: req?.token ?? 'token', rawInput: req?.input ?? {hello: 'world'}};
        await InterpretorDAL.addActivityTask(activity.activityArn, input);
        const result = await InterpretorService.getActivityTask(activity);
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
            const defaultTimeout = config.activityTaskDefaultTimeout;
            config.activityTaskDefaultTimeout = 1
            const before = new Date();
            const activity = await ActivityService.createActivity(getUser().id, 'tmp');
            const result = await InterpretorService.getActivityTask(activity);
            const after = new Date();

            const durationInSeconds = (after.getTime() - before.getTime()) / 1000;
            expect(Math.round(durationInSeconds)).toBe(config.activityTaskDefaultTimeout)
            expect(result.input).toBeNull();
            expect(result.taskToken).toBeNull();
            config.activityTaskDefaultTimeout = defaultTimeout;

        });

        it('should be giving a task only once', async () => {
            expect.assertions(2);

            const input = {hello: 'world'};
            const activity = await ActivityService.createActivity(getUser().id, 'tmp');
            await InterpretorDAL.addActivityTask(activity.activityArn, {...activityTask, rawInput: input, token: 'token'});
            const first = await InterpretorService.getActivityTask(activity);
            const second = await InterpretorService.getActivityTask(activity);

            expect(JSON.parse(first.input)).toStrictEqual(input);
            expect(second.input).toBeNull();
        });

        it('should only be giving a task belonging to the correct activity', async () => {
            expect.assertions(4);
            const defaultTimeout = config.activityTaskDefaultTimeout;
            config.activityTaskDefaultTimeout = 1
            const firstInput = {good: 'good'};
            const secondInput = {bad: 'bad'}
            const firstActivity = await ActivityService.createActivity(getUser().id, 'first');
            const secondActivity = await ActivityService.createActivity(getUser().id, 'second');
            const before = new Date();
            await InterpretorDAL.addActivityTask(firstActivity.activityArn, {...activityTask, rawInput: firstInput, token: 'token', effectiveInput: firstInput});
            await InterpretorDAL.addActivityTask(secondActivity.activityArn, {...activityTask, token: 'token', rawInput: secondInput, effectiveInput: secondInput});

            const firstActivityTask1 = await InterpretorService.getActivityTask(firstActivity);
            const firstActivityTask2 = await InterpretorService.getActivityTask(firstActivity);
            

            expect(JSON.parse(firstActivityTask1.input)).toStrictEqual(firstInput);
            expect(firstActivityTask2.input).toBeNull();

            const secondActivityTask = await InterpretorService.getActivityTask(secondActivity);
            const after = new Date();
            const durationInSeconds = (after.getTime() - before.getTime()) / 1000;
            expect(JSON.parse(secondActivityTask.input)).toStrictEqual(secondInput);
            expect(Math.round(durationInSeconds)).toBe(1)
            config.activityTaskDefaultTimeout = defaultTimeout;

        });
        
        it('should fail if the activity arn does not exists', async () => {
            expect.assertions(1);

            await expect(InterpretorService.getActivityTask({activityArn: dummyActivityArn})).rejects.toThrow(ActivityDoesNotExistError)
        });

        it('should fail if the activity arn is invalid', async () => {
            expect.assertions(1);

            await expect(InterpretorService.getActivityTask({activityArn: 'hello'})).rejects.toThrow(InvalidArnError);
        });
        
        it.each(['', 'a'.repeat(81), 81])("should fail if the worker name is '%p'", async (workerName: string) => {
            expect.assertions(1);
            const activity = await ActivityService.createActivity(getUser().id, 'tmp');
            await expect(InterpretorService.getActivityTask({workerName, activityArn: activity.activityArn})).rejects.toThrow(InvalidNameError);
        });
    });

    describe('send task success', () => {
        it('should work', async () => {
            expect.assertions(1);
            
            let wasCalled = false;
            Event.on(Event.CustomEvents.WorkerOutputReceived, () => {
                wasCalled = true;
                return Promise.resolve()
            })
            
            const {result} = await createAndGetActivityTaskHelper()
            await InterpretorService.sendTaskSuccess({taskToken: result.taskToken, output: '{}'});

            expect(wasCalled).toBe(true);
        });

        it('should throw if the token does not exists', async () => {
            expect.assertions(1);

            await expect(InterpretorService.sendTaskSuccess({taskToken: 'hello', output: '{}'})).rejects.toThrow(TaskDoesNotExistError);
        });

        it.each(['', null, '{', 'hello', 82, undefined])("should fail if the output is '%p'", async (output: string) => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(InterpretorService.sendTaskSuccess({taskToken: result.taskToken, output})).rejects.toThrow(InvalidOutputError);
        });

        it('shoud fail if the output length is too big', async () => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(InterpretorService.sendTaskSuccess({taskToken: result.taskToken, output: `{"a": ${'a'.repeat(taskOutputMaxLength)}}`})).rejects.toThrow(InvalidOutputError);
        });

        it('should fail if the task token is too big', async () => {
            expect.assertions(1);            
            
            await expect(InterpretorService.sendTaskSuccess({taskToken: 'a'.repeat(taskTokenMaxLength+1), output: '{}'})).rejects.toThrow(InvalidTokenError);
        })
        it.each(['', 82, null, undefined, {}])("should fail if the taskToken is '%p'", async (taskToken: string) => {
            expect.assertions(1);            
            
            await expect(InterpretorService.sendTaskSuccess({taskToken, output: '{}'})).rejects.toThrow(InvalidTokenError);
        }); 
    });

    describe('send task failure', () => {
        it('should work and correctly emit an event with the activityTask', async () => {
            expect.assertions(3);

            const cause = 'cause';
            const error = 'error';
            let wasCalled = false;

            Event.sendTaskFailureEvent.on(async (eventInput) => {
                wasCalled = true;
                expect(eventInput.cause).toBe(cause);
                expect(eventInput.error).toBe(error)
                return Promise.resolve()
            });

            const {result} = await createAndGetActivityTaskHelper();
            await InterpretorService.sendTaskFailure({taskToken: result.taskToken, cause, error});
            expect(wasCalled).toBe(true);
        });

        it('should throw if the token does not exists', async () => {
            expect.assertions(1);

            await expect(InterpretorService.sendTaskFailure({taskToken: 'hello'})).rejects.toThrow(TaskDoesNotExistError);
        });

        it.each([0, 0.1, {}])('should fail if the cause is %p', async (cause: string) => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, cause})).rejects.toThrow(InvalidParameterTypeError);
        });

        it('should fail if the length of the cause is bigger than 32768 characters', async () => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, cause: 'a'.repeat(32769)})).rejects.toThrow(ValidationExceptionError);
        });

        it.each([0, 0.1, {}])('should fail if the error is %p', async (error: string) => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, error})).rejects.toThrow(InvalidParameterTypeError);
        });

        it('should fail if the length of the error is bigger than 256 characters', async () => {
            expect.assertions(1);

            const {result} = await createAndGetActivityTaskHelper();
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, error: 'a'.repeat(32769)})).rejects.toThrow(ValidationExceptionError);
        });
    });
}});
