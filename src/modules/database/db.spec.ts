import { setupDatabase } from './db';
import db from './db';
import { setupDatabaseForTests } from '../../../tests/fixtures/db';
import { ActivityTable } from '@App/components/activity/activity.interfaces';
import { UserTable } from '@App/components/user/user.interfaces';
import { StateMachineTable, StateMachineVersionTable } from '@App/components/stateMachines/stateMachine.interfaces';
import { ExecutionTable } from '@App/components/execution/execution.interfaces';

describe('ensuring that the setted up database is correct', () => {

    beforeEach(async () => {
        await setupDatabaseForTests();
    });
    const cases = [
        [ActivityTable.tableName, [ActivityTable.idColumn, ActivityTable.nameColumn, ActivityTable.arnColumn, ActivityTable.creationDateColumn]],
        [UserTable.tableName, [UserTable.idColumn, UserTable.emailColumn, UserTable.secretColumn, UserTable.subColumn]],
        [StateMachineTable.tableName, [StateMachineTable.arnColumn, StateMachineTable.createDateColumn, StateMachineTable.definitionColumn, 
            StateMachineTable.roleArnColumn, StateMachineTable.statusColumn, StateMachineTable.typeColumn, StateMachineTable.nameColumn]],
        [StateMachineVersionTable.tableName, [StateMachineVersionTable.definitionColumn, StateMachineVersionTable.roleArnColumn, 
            StateMachineVersionTable.stateMachineArnColumn, StateMachineVersionTable.updateDateColumn]],
        [ExecutionTable.tableName, [ExecutionTable.executionArnColumn, ExecutionTable.inputColumn, ExecutionTable.nameColumn, ExecutionTable.outputColumn,
            ExecutionTable.startDateColumn, ExecutionTable.stateMachineArnColumn, ExecutionTable.statusColumn, ExecutionTable.stopDateColumn]]
    ];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    it.each(cases)('should correctly create the table %p', async (tableName: any, columns: any[]) => {
        expect.assertions(columns.length + 1);

        await setupDatabase();
    
        const tableExists = await db.schema.hasTable(tableName);
        expect(tableExists).toBe(true);
        for (let i = 0; i < columns.length; i++) {
            const columnExists = await db.schema.hasColumn(tableName, columns[i]);
            expect(columnExists).toBe(true);
        }
    });
});