export enum UserTable {
    tableName = 'users',
    idColumn = 'id',
    emailColumn = 'email',
    subColumn = 'sub',
    secretColumn = 'secret'
}

export interface IUser {
    id: string;
    email: string;
    sub: string;
    secret?: string;
}