import db from "@App/modules/database/db";
import * as Redis from "@App/modules/database/redis";

/* eslint-disable jest/require-top-level-describe */

afterAll(async (done) => {
    await db.destroy();
    await Redis.quitAsync();
    done();
});