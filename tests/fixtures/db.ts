import * as dbModule from '../../src/modules/database/db';
import { ActivityTable } from '../../src/components/activity/activity.interfaces';
import { UserTable } from '@App/components/user/user.interfaces';
import { StateMachineTable, StateMachineVersionTable } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionTable, ExecutionEventTable } from '@App/components/execution/execution.interfaces';
import * as Redis from '@App/modules/database/redis';

export const setupDatabaseForTests = async (): Promise<void> => {
    await Redis.quitAsync();
    Redis.startRedis();
    await Redis.flushallAsync();
    await clearDatabase();
    await dbModule.setupDatabase();
};

const clearDatabase = async (): Promise<void> => {
    const db = dbModule.default;
    await db(ExecutionEventTable.tableName).del();
    await db(ExecutionTable.tableName).del();
    await db(ActivityTable.tableName).del();
    await db(UserTable.tableName).del();
    await db(StateMachineVersionTable.tableName).del();
    await db(StateMachineTable.tableName).del();
};

export const emptyActivityTable = async(): Promise<void> => {
    const db = dbModule.default;
    await db(ActivityTable.tableName).del();
}

export const emptyStateMachineTable = async(): Promise<void> => {
    const db = dbModule.default;
    await db(StateMachineVersionTable.tableName).del();
    await db(StateMachineTable.tableName).del();
}

export const emptyExecutionTable = async (): Promise<void> => {
    const db = dbModule.default;
    await db(ExecutionTable.tableName).del();
}


export const countRowInTable = async(tableName: string): Promise<number> => {
    const db = dbModule.default;
    const numberOfRows = await db(tableName).count();
    return +numberOfRows[0]['count']
};
