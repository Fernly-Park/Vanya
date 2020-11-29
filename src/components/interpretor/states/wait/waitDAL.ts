import * as Redis from '@App/modules/database/redis';
import { RunningWaitState } from '../../interpretor.interfaces';
import * as RedisKey from '@App/modules/database/redisKeys'

export const addWaitStateInfo = async (task: RunningWaitState): Promise<void> => {
    const key = RedisKey.waitStateKey.get(task.token);
    await Redis.setAsync(key, JSON.stringify(task));
}

