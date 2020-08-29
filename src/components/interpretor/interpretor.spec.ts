import * as Redis from '@App/modules/database/redis';

import * as TaskService from '@App/components/task/taskService';
import { stateMachinesForTests, dummyExecutionArn } from '@Tests/testHelper';
import { IStateMachineDefinition } from '@App/components/stateMachines/stateMachine.interfaces';

import { startInterpretor, stopInterpreter } from '@App/components/interpretor/interpretorService';
import { Task } from '@App/components/task/task.interfaces';

describe('interpretor', () => {

    beforeEach(async () => {
        await Redis.flushallAsync();
        void startInterpretor().then();
    });

    afterAll(async () => {
        stopInterpreter();
        await Redis.quitAsync();
    })

});