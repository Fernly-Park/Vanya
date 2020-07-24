import request from 'supertest';
import express from 'express';
import initApp from '@App/app';
import { HttpStatusCode } from '@App/utils/httpStatusCode';
import http from 'http';
import { CreateActivityReq } from '@App/components/activity/activity.interfaces';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import { AWSConstant } from '@App/utils/constants';

describe('error are sent if aws header is not correctly set', () => {
    let server: http.Server;
    let app: express.Express
    beforeAll(async done => {
        app = await initApp();
        server = http.createServer(app);
        server.listen(3000, 'localhost', 511, done);
    });

    afterAll(done => {
        server.close(done);
    })

    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    it('should send a bad request when missing the \'x-amz-target\' header', async () => {
        expect.assertions(1);
        const headers = {
            'content-type':  'application/x-amz-json-1.0'
        };
        const requestBody: CreateActivityReq = {
            name: 'test'
        };
        const response = await request(app)
            .post("/api/activities")
            .set(headers)
            .send(JSON.stringify(requestBody));

        expect(response.status).toBe(HttpStatusCode.BAD_REQUEST)
    });

    it('shoud send a bad request when the content type is not set to \'application/x-amz-json-1.0\'', async () => {
        expect.assertions(1);
        const headers = {
            [AWSConstant.headers.TARGET_HEADER]: `${AWSConstant.headers.STEP_FUNCTION_PREFIX}.${AWSConstant.actions.CREATE_ACTIVITY}`,
            'content-type':  'application/dummy'
        };
        const requestBody: CreateActivityReq = {
            name: 'test'
        };
        const response = await request(app)
            .post("/api/activities")
            .set(headers)
            .send(JSON.stringify(requestBody));

        expect(response.status).toBe(HttpStatusCode.BAD_REQUEST)
    })
})
