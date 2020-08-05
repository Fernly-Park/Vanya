import * as StateMachineService from '@App/components/stateMachines/stateMachineService';
import { setupDatabaseForTests, emptyStateMachineTable } from '@Tests/fixtures/db';
import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';
import { InvalidNameError, InvalidArnError, StateMachineTypeNotSupported, StateMachineAlreadyExists } from '@App/errors/AWSErrors';
import { stateMachinesForTests, dummyRoleARN, dummyId } from '@Tests/testHelper';
import { CreateStateMachineInput } from "aws-sdk/clients/stepfunctions";
import { UserDoesNotExistsError } from '@App/errors/customErrors';
import { StateMachineTypes, StateMachineTable } from '@App/components/stateMachines/stateMachine.interfaces';
import db from '@App/modules/database/db';

describe('state machines', () => {

    let user: IUser;

    beforeAll(async () => {
        await setupDatabaseForTests();
        user = await UserService.createUser('sub', 'tmp@gmail.com');
    });

    beforeEach(async () => {
        await emptyStateMachineTable();
    })

    it('should correctly create a state machine', async () => {
        expect.assertions(8);

        const name = 'name';
        const definition = stateMachinesForTests.valid.validHelloWorld;
        const createdStateMachine = await StateMachineService.createStateMachine(user.id, {
            definition,
            name,
            roleArn: dummyRoleARN,
        });

        expect(createdStateMachine).toBeDefined();
        expect(createdStateMachine.name).toBe(name);
        expect(createdStateMachine.arn).toBeDefined();
        expect(createdStateMachine.creationDate).toBeDefined();
        expect(createdStateMachine.definition).toStrictEqual(JSON.parse(definition));
        expect(createdStateMachine.roleArn).toBe(dummyRoleARN);
        expect(createdStateMachine.status).toBe('ACTIVE');
        expect(createdStateMachine.type).toBe('STANDARD');
    });

    it('should corretly create a state machine with an EXPRESS type', async () => {
        expect.assertions(2);

        const type = StateMachineTypes.express;
        const createdStateMachine = await StateMachineService.createStateMachine(user.id, {
            definition: stateMachinesForTests.valid.validHelloWorld,
            name: 'name',
            roleArn: dummyRoleARN,
            type
        });

        expect(createdStateMachine).toBeDefined();
        expect(createdStateMachine.type).toBe(type);
    });

    it('should do nothing if the state machine already exists', async () => {
        expect.assertions(2);

        const req: CreateStateMachineInput = {
            definition: stateMachinesForTests.valid.validHelloWorld,
            name: 'name',
            roleArn: dummyRoleARN,
        }
        const firstStateMachine = await StateMachineService.createStateMachine(user.id, req);
        const secondStateMachine = await StateMachineService.createStateMachine(user.id, req);
        const stateMachineNumberInDb = await db(StateMachineTable.tableName).count();

        expect(firstStateMachine).toStrictEqual(secondStateMachine);
        expect(stateMachineNumberInDb[0]['count']).toBe('1');
    });

    it('should throw if a state machine with the same name and a different definition exists', async () => {
        expect.assertions(1);

        const req: CreateStateMachineInput = {
            definition: stateMachinesForTests.valid.validHelloWorld,
            name: 'name',
            roleArn: dummyRoleARN,
        }
        await StateMachineService.createStateMachine(user.id, req);
        req.definition = stateMachinesForTests.valid.validPassState;

        await expect(StateMachineService.createStateMachine(user.id, req)).rejects.toThrow(StateMachineAlreadyExists);
    });

    it('should throw if a state machine with the same name and a different role arn exists', async () => {
        expect.assertions(1);

        const req: CreateStateMachineInput = {
            definition: stateMachinesForTests.valid.validHelloWorld,
            name: 'name',
            roleArn: dummyRoleARN,
        }
        await StateMachineService.createStateMachine(user.id, req);
        req.roleArn = 'arn:aws:iam::012345678901:role/otherRole'

        await expect(StateMachineService.createStateMachine(user.id, req)).rejects.toThrow(StateMachineAlreadyExists);
    });

    it('should throw if the user id is invalid', async () => {
        expect.assertions(1);
        const req: CreateStateMachineInput = {
            definition: stateMachinesForTests.valid.validHelloWorld,
            name: 'name',
            roleArn: dummyRoleARN,
        };

        await expect(StateMachineService.createStateMachine(dummyId, req)).rejects.toThrow(UserDoesNotExistsError);
    });

    it('should throw if the state machine type is neither STANDARD nor EXPRESS', async () => {
        expect.assertions(1);

        const req: CreateStateMachineInput = {
            definition: stateMachinesForTests.valid.validHelloWorld,
            name: 'name',
            roleArn: dummyRoleARN,
            type: 'badType'
        };

        await expect(StateMachineService.createStateMachine(user.id, req)).rejects.toThrow(StateMachineTypeNotSupported);
    });

    const badSMNameCases = ["", " ", "   ", "<", ">", "{", "}", "[", "]", "*", "?", "\"", "#", "%", "\\", "^", "|", "~", "`", "$", "&", ",", ";", ":", "/"]
    it.each([badSMNameCases])('should throw if the state machine name is %p', async (name: string) => {
        expect.assertions(1);
        const definition = stateMachinesForTests.valid.validHelloWorld;
        await expect(StateMachineService.createStateMachine(user.id, {name,definition,roleArn: dummyRoleARN})).rejects.toThrow(InvalidNameError);
    });

    const badlyFormedArnCases = [null, undefined, '', 10, 'badlyFormedArn', 'arn:aws:states:us-east-1:999999999999:activity:' + 'a'.repeat(210)];
    it.each([badlyFormedArnCases])('should throw if the state machine role arn is %p', async (roleArn: string) => {
        const definition = stateMachinesForTests.valid.validHelloWorld;
        await expect(StateMachineService.createStateMachine(user.id, {name: 'name',definition,roleArn})).rejects.toThrow(InvalidArnError);
    });
});