import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests } from '@Tests/fixtures/db';


export const generateServiceTest = (describeText: string, tests: (getUser: () => IUser) => void): void => {
    
    // eslint-disable-next-line jest/valid-title
    describe(describeText, () => {
        let user: IUser;

        beforeEach(async () => {
            await setupDatabaseForTests();
            user = await UserService.createUser('sub', 'tmp@gmail.com');
        });

        tests(() => user);
    });
}