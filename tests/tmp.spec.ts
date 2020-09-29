import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';
import { setupDatabaseForTests } from '@Tests/fixtures/db';
import * as InterpretorService from '@App/components/interpretor/interpretorService';
import * as TaskService from '@App/components/task/taskService';
import * as Redis from '@App/modules/database/redis';
import { sleep, stateMachinesForTests } from './testHelper';
import { JSONPath } from 'jsonpath-plus';
import { WaitStateTaskInfo } from '@App/components/task/task.interfaces';

describe('random tests', () => {

    const addTime = async () => {
        const now = Date.now();
        const tenLater = new Date();
        tenLater.setSeconds(tenLater.getSeconds() + 4);
        const t = tenLater.getTime()

        const key = Redis.timerKey;
        await Redis.zaddAsync(key, now, 'now');
        await Redis.zaddAsync(key, t, 'later');
    }

    beforeAll(async () => {
        await setupDatabaseForTests();

    });

    it('should work', async () => {
        expect.assertions(0);
        const now = new Date();
        await Redis.zaddAsync(Redis.timerKey, 100, 'hello');
        const keys = await Redis.zrangebyscoreAsync(Redis.timerKey, '-inf', 1000)
        const results = await Redis.watchAsync(Redis.timerKey, async (watcher) => {
            await Redis.delAsync(Redis.timerKey)
            return new Promise((resolve, reject) => {
                watcher.multi()
                .del(Redis.timerKey)
                .exec((multiExecError, results) => {
                    if (multiExecError) reject(multiExecError);
                    resolve(results);
                });
            });
        });
    });
});
