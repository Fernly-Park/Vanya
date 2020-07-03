import { registerActivity } from "../../src/models/activityModel";
import {setupDatabaseForTests} from '../fixtures/db';
import db from '../../src/modules/database/db';
import { IActivity } from "../../src/interfaces/iActivity.model";
import { ActivityTable } from '../../src/modules/database/activityTable.model';

describe('create activity in db', () => {
    
    beforeEach(async () => {
        await setupDatabaseForTests();
    });
    
    it('correctly create an activity', async () => {
        expect.assertions(2);
        
        await registerActivity({id: -1, name: 'test'});
        const result = await db.select<IActivity[]>().table(ActivityTable.tableName);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('test');
    });
});