export interface IActivity {
    id: number
    arn: string;
    name: string;
    creationDate: Date;
}

export interface CreateActivityReq {
    name: string
}

export interface DeleteActivityReq {
    activityArn: string
}

export interface CreateActivityResp {
    activityArn: string,
    creationDate: Date
}