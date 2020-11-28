import * as Redis from '@App/modules/database/redis';
import { RunningWaitState } from '../../interpretor.interfaces';

export const addWaitStateInfo = async (task: RunningWaitState): Promise<void> => {
    const key = Redis.getWaitStateKey(task.token);
    await Redis.setAsync(key, JSON.stringify(task));
}

