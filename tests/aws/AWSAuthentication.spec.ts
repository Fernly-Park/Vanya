import { checkAWSSignature} from "@App/loaders/authentication/AWSAuthentication";
import * as UserDAL from '@App/components/user/userDAL';
import { setupDatabaseForTests } from "@Tests/fixtures/db";
import db from '@App/modules/database/db';
import { IUser } from "@App/components/user/user.interfaces";

describe('matching signature', () => {
    beforeEach(async () => {
        await setupDatabaseForTests();
    });

    const getCorrectHeader = () => {
        return {
            "user-agent": "aws-sdk-nodejs/2.710.0 win32/v14.4.0 callback",
            "content-type": "application/x-amz-json-1.0",
            "x-amz-target": "AWSStepFunctions.ListActivities",
            "x-amz-content-sha256": "61233024385b370ac88291f6e82662bd8047c859dd7e57031ad8ffbc588bd566",
            "content-length": "19",
            "host": "localhost:3000",
            "x-amz-date": "20200722T185803Z",
            "authorization": "AWS4-HMAC-SHA256 Credential=442081075552/20200722/eu-west/states/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-target, Signature=1a846589a7e666f4354a61af9f5ad5af411d25c626d9e46af2014e9ceb9c591b",
            "connection": "close"
        };
    };

    const correctUser: IUser = {
        email: 'test@gmail.com',
        id: '442081075552',
        sub: 'Heisenberg',
        secret: 'tmp'
    };
    const insertCorrectUser = async(): Promise<void> => {
        await UserDAL.insertUser(db, correctUser);
    }

    it('should validate a correct signature', async () => {
        expect.assertions(1);

        const headers = getCorrectHeader();
        await insertCorrectUser();
        
        const result = await checkAWSSignature(headers);
        expect(result.id).toBe(correctUser.id);
    });

    it('should fail if the signature is incorrect', async () => {
        expect.assertions(1);

        const headers = getCorrectHeader();
        headers.authorization = "AWS4-HMAC-SHA256 Credential=442081075552/20200722/eu-west/states/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-target, Signature=badSignature"
        await insertCorrectUser();

        const result = await checkAWSSignature(headers);
        expect(result).toBeNull();
    });

    it('should fail if the user secret is incorrect', async () => {
        expect.assertions(1);

        const headers = getCorrectHeader();
        await UserDAL.insertUser(db, {
            email: 'test@gmail.com',
            id: '442081075552',
            sub: 'Heisenberg',
            secret: 'badSecret'
        });
        const result = await checkAWSSignature(headers);
        expect(result).toBeNull();
    });

    it('should fail if the authorization header is not present', async () => {
        expect.assertions(1);
        const headers = getCorrectHeader();
        delete headers.authorization;

        const result = await checkAWSSignature(headers);
        expect(result).toBeNull();
    });
});