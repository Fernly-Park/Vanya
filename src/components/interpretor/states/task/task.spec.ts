/* eslint-disable jest/require-top-level-describe */
import { createSMAndStartExecutionHelper, dummyActivityArn, stateMachinesForTests } from '@Tests/testHelper';
import { ActivityDoesNotExistError, InvalidArnError, InvalidNameError, InvalidOutputError, InvalidParameterTypeError, InvalidTokenError, TaskDoesNotExistError, ValidationExceptionError } from '@App/errors/AWSErrors';
import { generateServiceTest } from '@Tests/testGenerator';
import config from '@App/config';
import { ActivityService } from '../../../activity';
import { InterpretorService } from '../..';
import { taskOutputMaxLength, taskTokenMaxLength } from '@App/utils/validationHelper';
import { ExecutionService } from '@App/components/execution';
import { TaskTimedOutError } from '@App/errors/customErrors';

generateServiceTest({options: {startInterpretor: true}, describeText: 'tasks', tests: (getUser) => {

    const setupTest = async (req?: {input?: Record<string, unknown>, stateMachineDef?: string, activityName?: string}) => {
        const activityName = req?.activityName ?? 'tmp';
        const activity = await ActivityService.createActivity(getUser().id, activityName);

        const {execution} = await createSMAndStartExecutionHelper({userId: getUser().id, stateMachineDef: req?.stateMachineDef ?? stateMachinesForTests.valid.validTask, 
            input : JSON.stringify(req?.input) ?? '{}', stateMachineName: `stateMachine${activityName}`});

        await InterpretorService.processNextState();
        return {
            activity,
            executionArn: execution.executionArn
        }
    };


    describe('get activit task', () => {
        it('should work', async () => {
            expect.assertions(1);

            const input = {hello: 'world'};
            const {activity} = await setupTest({input})
            const result = await InterpretorService.getActivityTask(activity);
            expect(JSON.parse(result.input)).toStrictEqual(input);
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
            const {activity} = await setupTest({input});
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
            const before = new Date();
            const {activity: firstActivity} = await setupTest({input: firstInput, activityName: 'tmp'});

            const sm = JSON.parse(stateMachinesForTests.valid.validTask);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            sm.States.Hello.Resource = 'arn:aws:states:eu-west:012345678901:activity:second'
            const {activity: secondActivity} = await setupTest({input: secondInput, activityName: 'second', stateMachineDef: JSON.stringify(sm)});

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
        it('should throw if the token does not exists', async () => {
            expect.assertions(1);

            await expect(InterpretorService.sendTaskSuccess({taskToken: 'hello', output: '{}'})).rejects.toThrow(TaskDoesNotExistError);
        });

        it.each(['', null, '{', 'hello', 82, undefined])("should fail if the output is '%p'", async (output: string) => {
            expect.assertions(1);

            const {activity} = await setupTest()
            const result = await InterpretorService.getActivityTask(activity);
            await expect(InterpretorService.sendTaskSuccess({taskToken: result.taskToken, output})).rejects.toThrow(InvalidOutputError);
        });

        it('shoud fail if the output length is too big', async () => {
            expect.assertions(1);

            const {activity} = await setupTest()
            const result = await InterpretorService.getActivityTask(activity);
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
        
        it('should send a task Timeout if the task is already aborted and a task success is sent', async () => {
            expect.assertions(1);

            const {activity, executionArn} = await setupTest();
            const result = await InterpretorService.getActivityTask(activity);
            await ExecutionService.stopExecution({executionArn});

            await expect(InterpretorService.sendTaskSuccess({taskToken: result.taskToken, output: '{}'})).rejects.toThrow(TaskTimedOutError);
        });

    });

    describe('send task failure', () => {
        it('should throw if the token does not exists', async () => {
            expect.assertions(1);

            await expect(InterpretorService.sendTaskFailure({taskToken: 'hello'})).rejects.toThrow(TaskDoesNotExistError);
        });

        it.each([0, 0.1, {}])('should fail if the cause is %p', async (cause: string) => {
            expect.assertions(1);

            const {activity} = await setupTest()
            const result = await InterpretorService.getActivityTask(activity);
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, cause})).rejects.toThrow(InvalidParameterTypeError);
        });

        it('should fail if the length of the cause is bigger than 32768 characters', async () => {
            expect.assertions(1);

            const {activity} = await setupTest()
            const result = await InterpretorService.getActivityTask(activity);
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, cause: 'a'.repeat(32769)})).rejects.toThrow(ValidationExceptionError);
        });

        it.each([0, 0.1, {}])('should fail if the error is %p', async (error: string) => {
            expect.assertions(1);

            const {activity} = await setupTest()
            const result = await InterpretorService.getActivityTask(activity);
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, error})).rejects.toThrow(InvalidParameterTypeError);
        });

        it('should fail if the length of the error is bigger than 256 characters', async () => {
            expect.assertions(1);

            const {activity} = await setupTest()
            const result = await InterpretorService.getActivityTask(activity);
            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken, error: 'a'.repeat(32769)})).rejects.toThrow(ValidationExceptionError);
        });

        it('should send a task Timeout if the task is already aborted and a task failure is sent', async () => {
            expect.assertions(1);

            const {activity, executionArn} = await setupTest();
            const result = await InterpretorService.getActivityTask(activity);
            await ExecutionService.stopExecution({executionArn});

            await expect(InterpretorService.sendTaskFailure({taskToken: result.taskToken})).rejects.toThrow(TaskTimedOutError);
        });
    });

    describe('send task heartbeat', () => {
        it('should send a task Timeout if the task is already aborted and a task heartbeat is sent', async () => {
            expect.assertions(1);

            const {activity, executionArn} = await setupTest();
            const result = await InterpretorService.getActivityTask(activity);
            await ExecutionService.stopExecution({executionArn});

            await expect(InterpretorService.sendTaskHeartbeat({taskToken: result.taskToken})).rejects.toThrow(TaskTimedOutError);
        });
    })
}});

