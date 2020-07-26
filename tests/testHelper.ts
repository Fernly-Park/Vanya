import { AWSConstant } from "@App/utils/constants";
import request from 'supertest'
import app from '@App/app';
import * as ArnHelper from '@App/utils/ArnHelper';
import * as ActivityService from '@App/components/activity/activityService';
import { IActivity } from "@App/components/activity/activity.interfaces";

const requestFactory = (action: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (body: any) => {
        const headers = {
            [AWSConstant.headers.TARGET_HEADER]: `${AWSConstant.headers.STEP_FUNCTION_PREFIX}.${action}`,
            'content-type':  'application/x-amz-json-1.0'
        }
        return await request(app)
            .post("/")
            .set(headers)
            .send(JSON.stringify(body));
    }
}
export const createActivityRequest = requestFactory(AWSConstant.actions.CREATE_ACTIVITY);

export const dummyId = '999999999999';
export const dummyActivityArn = ArnHelper.generateActivityArn(dummyId, 'randomName');

