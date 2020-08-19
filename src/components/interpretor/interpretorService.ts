import * as Redis from '@App/modules/database/redis'

export const startInterpretor = async (): Promise<void> => {
    // eslint-disable-next-line no-constant-condition
        const result = await Redis.blpopAsync(Redis.systemTaskKey, 0)
        console.log(result);
};