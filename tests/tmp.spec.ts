import * as Redis from '@App/modules/database/redis';
import * as UserService from '@App/components/user/userService';
import * as StateMachineDAL from '@App/components/stateMachines/stateMachineDAL';
import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests, emptyExecutionTable } from '@Tests/fixtures/db';

describe('caca', () => {

    let user: IUser;

    beforeAll(async () => {
        await setupDatabaseForTests();
        user = await UserService.createUser('sub', 'tmp@gmail.com');
    });

    beforeEach(async () => {
        await Redis.flushallAsync();
        await emptyExecutionTable();
    });

    it('should work', async () => {
        expect.assertions(0);
        StateMachineDAL.createStateMachine
    })
})
