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
        expect.assertions(6);

        const email = "test@gmail.com";
        const sub = "sub";
        const result = await UserService.createUser(sub, email);
        const createdUser = await UserDAL.selectUserByEmail(db, email);

        expect(result.id).toBeDefined()
        expect(result.email).toBe(email);
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

describe('retrieve user', () => {
    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    it('should correctly retrieve the user by id', async () => {
        expect.assertions(1);
        
        const email = "test@gmail.com";
        const sub = "sub";
        const createdUser = await UserService.createUser(sub, email);
        const result = await UserService.retrieveUserById(createdUser.id);

        expect(result.email).toBe(email);
    });

    it('should return undefined if the user id does not exists', async () => {
        expect.assertions(1);
        const result = await UserService.retrieveUserById('999999999999');
        expect(result).toBeUndefined();
    });

    it('should throw if the id is badly formed', async () => {
        expect.assertions(1);

        await expect(UserService.retrieveUserById('badlyFormedId')).rejects.toThrow(InvalidInputError);
    })

    it('should correctly retrieve an user by email', async () => {
        expect.assertions(2);
        
        const email = "test@gmail.com";
        await UserService.createUser('sub', email);
        const result = await UserService.retrieveUserByEmail(email);

        expect(result).toBeDefined();
        expect(result.email).toBe(email);
    });

    it('should return undefined if the user email does not exists', async () => {
        expect.assertions(1);

        const result = await UserService.retrieveUserByEmail('unexistingEmail@example.com');
        
        expect(result).toBeUndefined();
    });

    it('should throw if the email is badly formed', async () => {
        expect.assertions(1);

        await expect(UserService.retrieveUserByEmail('badlyFormedEmail')).rejects.toThrow(InvalidInputError);
    });
});

describe('update user secret', () => {
    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    it('should correctly update the user secret', async () => {
        expect.assertions(1);

        const email = "test@gmail.com";
        const secret = 'secret';

        const userBeforeSecretWasSet = await UserService.createUser("sub", email);
        await UserService.setUserSecret(userBeforeSecretWasSet.id, secret);
        const userAfterSecretWasSet = await UserDAL.selectUserByEmail(db, email);

        expect(userAfterSecretWasSet.secret).toBe(secret);
    });
})