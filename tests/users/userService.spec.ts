import { setupDatabaseForTests } from "@Tests/fixtures/db";
import * as UserService from "@App/components/user/userService";
import * as UserDAL from "@App/components/user/userDAL";
import db from '@App/modules/database/db';
import { InvalidInputError, ResourceAlreadyExistsError } from "@App/errors/customErrors";

describe('create user', () => {

    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    it('should correctly create a user', async () => {
        expect.assertions(4);

        const email = "test@gmail.com";
        const sub = "sub";
        await UserService.createUser(sub, email);
        const createdUser = await UserDAL.selectUserByEmail(db, email);

        expect(createdUser).toBeDefined();
        expect(createdUser.id).toBeDefined();
        expect(createdUser.sub).toBe(sub);
        expect(createdUser.secret).toBeNull();
    });

    it.each(['notAnEmail', '', 1, null, undefined])('should throw if the user email is %p', async (email: string) => {
        expect.assertions(1);

        await expect(UserService.createUser("sub", email)).rejects.toThrow(InvalidInputError);
    });

    it.each(['', null, undefined, 1])('should throw if the user sub is %p', async (sub: string) => { 
        expect.assertions(1);

        await expect(UserService.createUser(sub, "test@gmail.com")).rejects.toThrow(InvalidInputError);
    });

    it('should throw if the user already exists', async () => {
        expect.assertions(1);

        const email = "test@gmail.com";
        const sub = "sub";
        await UserService.createUser(sub, email);

        await expect(UserService.createUser(sub, email)).rejects.toThrow(ResourceAlreadyExistsError);
    });
});