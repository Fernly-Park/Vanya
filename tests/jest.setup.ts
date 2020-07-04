import db from "@App/modules/database/db";

/* eslint-disable jest/require-top-level-describe */

afterAll(async (done) => {
    await db.destroy();
    done();
});