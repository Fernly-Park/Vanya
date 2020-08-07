import * as dbModule from '../../src/modules/database/db';
import { ActivityTable } from '../../src/components/activity/activity.interfaces';
import { UserTable } from '@App/components/user/user.interfaces';
import { StateMachineTable } from '@App/components/stateMachines/stateMachine.interfaces';

export const setupDatabaseForTests = async (): Promise<void> => {
    await clearDatabase();
    await dbModule.setupDatabase();
    
};

const clearDatabase = async (): Promise<void> => {
    const db = dbModule.default;
    await db.schema.dropTableIfExists(ActivityTable.tableName);
    await db.schema.dropTableIfExists(UserTable.tableName);
    await db.schema.dropTableIfExists(StateMachineTable.tableName);
};

export const emptyActivityTable = async(): Promise<void> => {
    const db = dbModule.default;
    await db(ActivityTable.tableName).del();
}

export const emptyStateMachineTable = async(): Promise<void> => {
    const db = dbModule.default;
    await db(StateMachineTable.tableName).del();
}


export const countRowInTable = async(tableName: string): Promise<number> => {
    const db = dbModule.default;
    const numberOfRows = await db(tableName).count();
    return +numberOfRows[0]['count']
};
