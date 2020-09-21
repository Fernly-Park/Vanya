import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import * as TaskService from '@App/components/task/taskService';
import * as Redis from '@App/modules/database/redis';
import { sleep, stateMachinesForTests } from './testHelper';
import { JSONPath } from 'jsonpath-plus';
import { TimerInfo } from '@App/components/task/task.interfaces';

describe('random tests', () => {

    const addTime = async () => {
        const now = Date.now();
        const tenLater = new Date();
        tenLater.setSeconds(tenLater.getSeconds() + 4);
        const t = tenLater.getTime()

        const key = Redis.delayedTaskKey;
        await Redis.zaddAsync(key, now, 'now');
        await Redis.zaddAsync(key, t, 'later');
    }

    beforeAll(async () => {
        await setupDatabaseForTests();

    });

    it('should work', async () => {
        expect.assertions(0);
        const now = new Date();
        await Redis.zaddAsync(Redis.delayedTaskKey, 100, 'hello');
        const keys = await Redis.zrangebyscoreAsync(Redis.delayedTaskKey, '-inf', 1000)
        const results = await Redis.watchAsync(Redis.delayedTaskKey, async (watcher) => {
            await Redis.delAsync(Redis.delayedTaskKey)
            return new Promise((resolve, reject) => {
                watcher.multi()
                .del(Redis.delayedTaskKey)
                .exec((multiExecError, results) => {
                    if (multiExecError) reject(multiExecError);
                    resolve(results);
                });
            });
        });
    });
});
