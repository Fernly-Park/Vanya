import { AWSConstant } from "@App/utils/constants";
import request from 'supertest'
import app from '@App/app';

const requestFactory = (action: string) => {
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



