import * as UserService from '@App/components/user/userService';
import * as InterpretorService from '@App/components/interpretor/interpretorService';

import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import { mockDateNow } from './testHelper';


export const generateServiceTest = (req: {describeText: string, tests: (getUser: () => IUser) => void, options?: {
    startInterpretor?: boolean,
    mockDate?: boolean
}}): void => {
    const RealDate = Date.now;
    // eslint-disable-next-line jest/valid-title
    describe(req.describeText, () => {
        let user: IUser;
        
        beforeAll(() => {
            if(req.options?.mockDate) {
                jest.spyOn(Date, 'now').mockImplementation(() => new Date(mockDateNow).getTime())
            }
        });

        afterAll(() => {
            if (req.options?.mockDate) {
                Date.now = RealDate;
            }
        })
        beforeEach(async () => {
            await setupDatabaseForTests();
            user = await UserService.createUser('sub', 'tmp@gmail.com');
            if (req.options?.startInterpretor) {
                void InterpretorService.startInterpretor().then();
            }
        });

        if (req.options?.startInterpretor) {
            afterEach(() => {
                InterpretorService.stopInterpreter();
            })
        }
        req.tests(() => user);
    });
}