
import request from 'supertest';
import app from '../../src/app';
import { HttpStatusCode } from '@App/utils/httpStatusCode';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import { IActivity } from '@App/interfaces/iActivity.model';
import * as ArnHelper from '@App/services/ArnHelper';
import { CreateActivityResp } from '@App/interfaces/resp/ActivityResp.model';

describe('create activities api', () => {

    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    it('activity is correctly created', async () => {
        expect.assertions(3);

        const activityName = 'name';
        const response = await request(app)
            .post("/api/activities")
            .send({name: activityName});
        const createdActivity: CreateActivityResp = response.body;

        const activityNameFromArn = ArnHelper.retrieveNameFromArn(createdActivity.activityArn);
        expect(response.status).toBe(HttpStatusCode.OK);
        expect(activityNameFromArn).toBe(activityName);
        expect(createdActivity.creationDate).toBeDefined();
    });

    const badActivityNameCases = ["", "/"]
    it.each(badActivityNameCases)("shoud return a bad request for the activity '%p'", async (activityName: string) => {
        expect.assertions(1);

        const response = await request(app)
        .post("/api/activities")
        .send({name: activityName});

        expect(response.status).toBe(HttpStatusCode.BAD_REQUEST);
    });

    it('should return a 409 error code if trying to use an already existing activity name', async () => {
        expect.assertions(2);
        
        const activityName = 'name';

        const response1 = await request(app)
            .post("/api/activities")
            .send({name: activityName});

        const response2 = await request(app)
            .post("/api/activities")
            .send({name: activityName});

        expect(response1.status).toBe(HttpStatusCode.OK);
        expect(response2.status).toBe(HttpStatusCode.CONFLICT)
    });
})
