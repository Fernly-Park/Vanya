
import request from 'supertest';
import app from '../../src/app';

describe('create activities', () => {
    it('activity', async () => {
        expect.assertions(2);
        const response1 = await request(app).get("/api/activities");
        const response2 = await request(app).get("/api/activities");

        expect(response1.status).toBe(201);
        expect(response2.status).toBe(201);
    })
})
