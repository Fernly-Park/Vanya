import * as TaskService from '@App/components/task/taskService';
import * as Redis from '@App/modules/database/redis';
import * as db from '@App/modules/database';

import { stateMachinesForTests } from '@Tests/testHelper';
import { IStateMachineDefinition } from '@App/components/stateMachines/stateMachine.interfaces';
import { startInterpretor } from '@App/components/interpretor/interpretorService';

describe('tasks', () => {
    beforeEach(async () => {
        await Redis.flushallAsync();
        // void startInterpretor().then();
    });
    afterAll(async () => {
        await Redis.quitAsync();
    })

    describe('add', () => {

        it('should correctly add a task', async () => {
            expect.assertions(2);
            const helloWorldSM: IStateMachineDefinition = JSON.parse(stateMachinesForTests.valid.validHelloWorld);
            const task = {execution: 'tmp', state: helloWorldSM.States[helloWorldSM.StartAt]};
            await TaskService.addTask(task);

            const numberOfTasks = await Redis.llenAsync(Redis.systemTaskKey);
            const retrievedTask = await Redis.lpopAsync(Redis.systemTaskKey);
            
            expect(numberOfTasks).toBe(1);
            expect(JSON.parse(retrievedTask)).toStrictEqual(task);
        })
    });
})