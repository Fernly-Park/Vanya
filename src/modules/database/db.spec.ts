/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { setupDatabase } from './db';
import db from './db';
import { setupDatabaseForTests } from '../../../tests/fixtures/db';
import { ActivityTable } from '@App/components/activity/activity.interfaces';
import { UserTable } from '@App/components/user/user.interfaces';
import { StateMachineTable, StateMachineVersionTable } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionTable, ExecutionEventTable } from '@App/components/execution/execution.interfaces';

describe('ensuring that the setted up database is correct', () => {

    beforeEach(async () => {
        await setupDatabaseForTests();
    });
    const cases =  [ActivityTable, UserTable, StateMachineTable, StateMachineVersionTable, ExecutionTable, ExecutionEventTable, 
        ActivityTable, ActivityTable, ActivityTable, ActivityTable
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    it.each(cases)('should correctly create the table %p', async (table: any) => {
        expect.assertions(Object.keys(table).length);

        await setupDatabase();
    
        const tableExists = await db.schema.hasTable(table['tableName']);
        expect(tableExists).toBe(true);
        for(const key of Object.keys(table)) {
            if (key !== 'tableName') {
                const columnExists = await db.schema.hasColumn(table['tableName'], table[key]);
                expect(columnExists).toBe(true);
            }
        }
    });
});