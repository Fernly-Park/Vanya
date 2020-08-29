import * as Redis from '@App/modules/database/redis';

import * as TaskService from '@App/components/task/taskService';
import { stateMachinesForTests } from '@Tests/testHelper';
import { IStateMachineDefinition } from '@App/components/stateMachines/stateMachine.interfaces';

import { startInterpretor, stopInterpreter } from '@App/components/interpretor/interpretorService';

describe('interpretor', () => {

    beforeEach(async () => {
        await Redis.flushallAsync();
        void startInterpretor().then();
    });
    afterAll(async () => {
        stopInterpreter();
        await Redis.quitAsync();
    })

    it('should correctly retrieve a blocked task', async () => {
        expect.assertions(0);

        // const helloWorldSM: IStateMachineDefinition = JSON.parse(stateMachinesForTests.valid.validHelloWorld);
        // const task = {execution: 'tmp', state: helloWorldSM.States[helloWorldSM.StartAt],}
        // await TaskService.addTask(task)
    });
});