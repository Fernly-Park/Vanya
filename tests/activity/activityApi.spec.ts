
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import AWS from 'aws-sdk';
import app from '@App/app';
import * as ArnHelper from '@App/utils/ArnHelper';
import { HttpStatusCode } from '@App/utils/httpStatusCode';
import http from 'http';
import config from '@App/config';
import { CreateActivityResp, CreateActivityReq } from '@App/components/activity/activity.interfaces';
import * as TestHelper from '@Tests/testHelper';

describe('create activities api', () => {
    let server: http.Server;
    let stepFunctions: AWS.StepFunctions;

    beforeAll(done => {
        server = http.createServer(app);
        server.listen(3000, 'localhost', 511, done);
        stepFunctions = new AWS.StepFunctions({
            endpoint: `http://localhost:${config.port}`,
            region: config.region,
            credentials: new AWS.Credentials({accessKeyId: 'caca', secretAccessKey: 'tmp'})
        });
    });

    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    afterAll(done => {
        server.close(done);
    })

    it('works using the amazon sdk', async () => {
        expect.assertions(3);

        const result = await stepFunctions.createActivity({name: 'caca'}).promise();
        expect(result).toBeDefined();
        expect(result.activityArn.split(':')[1]).toBe('caca');
        expect(result.creationDate).toBeDefined();
    });

    it('should create an activity', async () => {
        expect.assertions(3);
        const requestBody: CreateActivityReq = {
            name: 'name'
        };
        const response = await TestHelper.createActivityRequest(requestBody);
            
        const createdActivity: CreateActivityResp = response.body;
        expect(response.status).toBe(HttpStatusCode.OK);
        const activityNameFromArn = ArnHelper.retrieveNameFromArn(createdActivity.activityArn);
        expect(activityNameFromArn).toBe(requestBody.name);
        expect(createdActivity.creationDate).toBeDefined();
    });

    const badActivityNameCases = ["", "/"]
    it.each(badActivityNameCases)("shoud return a bad request for the activity '%p'", async (activityName: string) => {
        expect.assertions(1);

        const requestBody: CreateActivityReq = {name: activityName}
        const response = await TestHelper.createActivityRequest(requestBody);

        expect(response.status).toBe(HttpStatusCode.BAD_REQUEST);
    });

    it('should return a 409 error code if trying to use an already existing activity name', async () => {
        expect.assertions(2);
        
        const requestBody: CreateActivityReq = {
            name: 'name'
        };

        const response1 = await TestHelper.createActivityRequest(requestBody);
        const response2 = await TestHelper.createActivityRequest(requestBody);

        expect(response1.status).toBe(HttpStatusCode.OK);
        expect(response2.status).toBe(HttpStatusCode.CONFLICT)
    });
})
