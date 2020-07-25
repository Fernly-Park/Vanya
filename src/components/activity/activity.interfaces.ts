import {StepFunctions} from 'aws-sdk';

export enum ActivityTable {
    tableName = 'activities',
    idColumn = 'id',
    nameColumn = 'name',
    arnColumn = 'arn',
    creationDateColumn = 'creationDate'
}

export interface IActivity {
    id: number
    arn: string;
    name: string;
    creationDate: Date;
}