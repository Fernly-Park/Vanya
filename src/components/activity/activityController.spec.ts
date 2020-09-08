/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import AWS from 'aws-sdk';
import initApp from '@App/app';
import { HttpStatusCode } from '@App/utils/httpStatusCode';
import http from 'http';
import * as ArnHelper from '@App/utils/ArnHelper';
import { dummyId, setupForTestAgainstServer } from '@Tests/testHelper';

describe('activity api tests', () => {
    let server: http.Server;
    let stepFunctions: AWS.StepFunctions;

    beforeAll(async done => {
        const app = await initApp()
        server = http.createServer(app);
        server.listen(3000, 'localhost', 511, done);
    });

    beforeEach(async () => {
        stepFunctions = await setupForTestAgainstServer()
    });

    afterAll(done => {
        server.close(done);
    })

    describe('create activities', () => {
        it('works using the amazon sdk', async () => {
            expect.assertions(3);
            const name = 'name';
            const result = await stepFunctions.createActivity({name}).promise();
            expect(result).toBeDefined();
            expect(result.activityArn.split(':')[6]).toBe(name);
            expect(result.creationDate).toBeDefined();
        });
    
        const badActivityNameCases = ["", "/"]
        it.each(badActivityNameCases)("shoud return a bad request for the activity '%p'", async (activityName: string) => {
            expect.assertions(1);
    
            await expect(stepFunctions.createActivity({name: activityName}).promise()).rejects.toThrow(expect.objectContaining({statusCode: HttpStatusCode.BAD_REQUEST}));
        });
    
        it('should return the same activity if called twice with the same name', async () => {
            expect.assertions(2);
            
            const name = 'name';
    
            const response1 = await stepFunctions.createActivity({name}).promise();
            const response2 = await stepFunctions.createActivity({name}).promise();

            expect(response1).toBeDefined();
            expect(response2).toStrictEqual(response1);
    
        });
    })
    
    describe('delete activity', () => {
        it('should correctly delete the activity', async () => {
            expect.assertions(1);

            const createdActivity = await stepFunctions.createActivity({name: 'name'}).promise();
            const result = await stepFunctions.deleteActivity({activityArn: createdActivity.activityArn}).promise();

            expect(result).toBeDefined();
        });

        it('should send nothing if the activity does not exists', async () => {
            expect.assertions(1);

            const activityArn = ArnHelper.generateActivityArn(dummyId, 'randomName');
            const result = await stepFunctions.deleteActivity({activityArn}).promise();

            expect(result).toBeDefined();
        });

        it('should throw if the arn is badly formed', async () => {
            expect.assertions(1);
            await expect(stepFunctions.deleteActivity({activityArn: 'badlyFormedArn'}).promise()).rejects.toThrow(expect.objectContaining({statusCode: HttpStatusCode.BAD_REQUEST}));
        });
    });

    describe('get activity', () => {
        it('should correctly retrieve an existing activity', async () => {
            expect.assertions(4);
            const activityName = 'name';
            const createdActivity = await stepFunctions.createActivity({name: activityName}).promise();
            const result = await stepFunctions.describeActivity({activityArn: createdActivity.activityArn}).promise();

            expect(result).toBeDefined();
            expect(result.activityArn).toBeDefined();
            expect(result.name).toBe(activityName);
            expect(result.creationDate).toBeDefined();
        });

        it('should send a bad request if the activity does not exists', async () => {
            expect.assertions(1);

            const activityArn = ArnHelper.generateActivityArn(dummyId, 'randomName');

            await expect(stepFunctions.describeActivity({activityArn}).promise()).rejects.toThrow(expect.objectContaining({statusCode: HttpStatusCode.BAD_REQUEST}));

        });

        it('should send a bad request if the arn is invalid', async () => {
            expect.assertions(1);

            await expect(stepFunctions.describeActivity({activityArn: 'badArn'}).promise()).rejects.toThrow(expect.objectContaining({statusCode: HttpStatusCode.BAD_REQUEST}));
        });
    });

    describe('list activities', () => {
        const createActivities = async (numberOfActivities: number): Promise<void> => {
            for (let i = 0; i < numberOfActivities; i++) {
                const activityName = `name${i.toString().padStart(3, "0")}`
                await stepFunctions.createActivity({name: activityName}).promise();
            }
        };
        it('should correctly retrieve activities', async () => {
            expect.assertions(4);
            
            const numberOfActivities = 10;
            await createActivities(numberOfActivities);
            const {activities, nextToken} = await stepFunctions.listActivities().promise();
            
            expect(activities).toHaveLength(numberOfActivities);
            expect(activities[0].name).toBe('name000');
            expect(activities[9].name).toBe('name009');
            expect(nextToken).toBeNull();
        });

        it('should send a bad request if the maxResult is invalid', async () => {
            expect.assertions(1);
            await expect(stepFunctions.listActivities({maxResults: -1}).promise()).rejects.toThrow(expect.objectContaining({statusCode: HttpStatusCode.BAD_REQUEST}));
        });

        it('should send a bad request if the token is invalid', async () => {
            expect.assertions(1);
            await expect(stepFunctions.listActivities({nextToken: 'test'}).promise()).rejects.toThrow(expect.objectContaining({statusCode: HttpStatusCode.BAD_REQUEST}));
        });
    });
})
