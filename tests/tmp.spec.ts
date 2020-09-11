import * as Redis from '@App/modules/database/redis';
import * as UserService from '@App/components/user/userService';
import * as StateMachineDAL from '@App/components/stateMachines/stateMachineDAL';
import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests, emptyExecutionTable } from '@Tests/fixtures/db';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import * as TaskService from '@App/components/task/taskService';

describe('caca', () => {

    let user: IUser;

    beforeAll(async () => {
        await setupDatabaseForTests();
        user = await UserService.createUser('sub', 'tmp@gmail.com');
        void InterpretorService.startInterpretor().then();
    });

    afterAll(async () => {
        InterpretorService.stopInterpreter();
    })
    it('should work', async () => {
        expect.assertions(0);
        const task = await TaskService.getGeneralTask();
    })

    it('should also work', () => {
        expect.assertions(0);
    })
})
