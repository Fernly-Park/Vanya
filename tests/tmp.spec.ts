import * as Redis from '@App/modules/database/redis';
import * as db from '@App/modules/database';

import * as TaskService from '@App/components/task/taskService';
import { stateMachinesForTests } from '@Tests/testHelper';
import { IStateMachineDefinition } from '@App/components/stateMachines/stateMachine.interfaces';

describe('caca', () => {
    it('should work', async () => {
        expect.assertions(0);
        // await Redis.flushallAsync();
        // await db.setupDatabases();

        // const helloWorldSM: IStateMachineDefinition = JSON.parse(stateMachinesForTests.valid.validHelloWorld);
        // const task = {execution: 'tmp', state: helloWorldSM.States[helloWorldSM.StartAt]};
        // await TaskService.addTask(task);

        // await Redis.quitAsync();
    })
})
