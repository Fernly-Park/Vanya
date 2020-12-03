
import * as Redis from '@App/modules/database/redis';
import config from "@App/config";
import { ActivityTaskStatus, RunningTaskState } from '../../interpretor.interfaces';
import * as RedisKey from '@App/modules/database/redisKeys'

export const addTaskToActivityQueue = async (activityArn: string, taskInfo: RunningTaskState): Promise<void> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    await Redis.rpushAsync(key, JSON.stringify(taskInfo));
}


export const modifyActivityTaskStatus = async (token: string, newStatus: ActivityTaskStatus, previousEventId?: number): Promise<void> => {
    const key = RedisKey.runningTaskStateKey.get(token);
    await Redis.jsonsetAsync(key, '.status', JSON.stringify(newStatus));

    if (previousEventId != null) {
        await Redis.jsonsetAsync(key, '.previousEventId', JSON.stringify(previousEventId))
    }
}

export const popActivityTask = async (activityArn: string): Promise<RunningTaskState> => {
    const key = RedisKey.activityTaskKey.get(activityArn);
    const result = await Redis.blpopAsync(key, config.activityTaskDefaultTimeout);
    return result ? JSON.parse(result[1]) as RunningTaskState : null;
}
