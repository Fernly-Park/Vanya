import * as UserDAL from '@App/components/user/userDAL';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import db from '@App/modules/database/db';
import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import { mockDateNow } from './testHelper';
import { UserService } from '@App/components/user';


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
            await UserDAL.insertUser(db, {
                email: 'tmp@gmail.com',
                id: '012345678901',
                sub: 'sub',
                secret: 'secret'
            })
            user = await UserService.retrieveUserByEmail('tmp@gmail.com');
            if (req.options?.startInterpretor) {
                InterpretorService.startInterpretor();
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