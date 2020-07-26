import {StepFunctions} from 'aws-sdk';

export enum ActivityTable {
    tableName = 'activities',
    idColumn = 'id',
    nameColumn = 'name',
    arnColumn = 'activityArn',
    creationDateColumn = 'creationDate'
}

export interface IActivity {
    activityArn: string;
    name: string;
    creationDate: Date;
}