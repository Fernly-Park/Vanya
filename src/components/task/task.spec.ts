import * as TaskService from '@App/components/task/taskService';
import * as Redis from '@App/modules/database/redis';

import { dummyStateMachineArn } from '@Tests/testHelper';
import { Task } from '@App/components/task/task.interfaces';

describe('tasks', () => {
    beforeEach(async () => {
        Redis.startRedis();
        await Redis.flushallAsync();
    });
    afterAll(async () => {
        await Redis.quitAsync();
    })

    describe('add', () => {
        it('should correctly add a task', async () => {
            expect.assertions(2);
            const task: Task = {executionArn: 'tmp', stateName: 'tmp', stateMachineArn: dummyStateMachineArn,  input: {}, previousEventId: 0};
            await TaskService.addTask(task);

            const numberOfTasks = await Redis.llenAsync(Redis.systemTaskKey);
            const retrievedTask = await Redis.lpopAsync(Redis.systemTaskKey);
            
            expect(numberOfTasks).toBe(1);
            expect(JSON.parse(retrievedTask)).toStrictEqual(task);
        })
    });
})