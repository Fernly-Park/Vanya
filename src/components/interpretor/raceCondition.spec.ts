import { generateServiceTest } from "@Tests/testGenerator";
import { createSMAndStartExecutionHelper, TestStateMachine } from "@Tests/testHelper";
import fs from 'fs';
import { join } from "path";
import * as TestHelper from '@Tests/testHelper';
import { ActivityService } from "../activity";
import { TaskTimedOutError } from "@App/errors/customErrors";
import { InterpretorService } from ".";

generateServiceTest({describeText: 'test race condition in state machines', options: {mockDate: false, startInterpretor: true}, tests: (getUser => {
    describe('on task state', () => {
        it('should not send the same task token when retrying a task state', async () => {
            expect.assertions(2);
            const testFile = JSON.parse(fs.readFileSync(join(__dirname, 'tests', 'task', 'task-retry-timeout.json'), 'utf-8')) as TestStateMachine
            const stateMachineDef = testFile.definition;
            const activity = await ActivityService.createActivity(getUser().id, 'tmp');
            await createSMAndStartExecutionHelper({userId: getUser().id, stateMachineDef: JSON.stringify(stateMachineDef), 
                input: JSON.stringify({timeout: 0, heartbeat: 1})});

            let taskToken: string;
            do {
                taskToken = (await InterpretorService.getActivityTask({activityArn: activity.activityArn})).taskToken;
            } while (!taskToken)

            await TestHelper.sleep(1000);
            await expect(InterpretorService.sendTaskSuccess({taskToken, output: JSON.stringify({})})).rejects.toThrow(TaskTimedOutError)
            const newTaskToken = (await InterpretorService.getActivityTask({activityArn: activity.activityArn})).taskToken;
            expect(taskToken).not.toBe(newTaskToken);
        });
    });
})});