import { Model } from 'objection';

class Activity extends Model {
    static get tableName() {
        return 'activities';
    }

    // static get jsonSchema() {
    //     return {
    //         type: 'object',
    //         required: ['arn', 'name']
    //     };
    // }
}

module.exports = Activity;