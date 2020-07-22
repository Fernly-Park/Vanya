import { generateAWSSignature} from "@App/loaders/authentication/AWSAuthentication";

describe('matching signature', () => {

    it('should create a matching signature', () => {
        expect.assertions(1);
        const result = generateAWSSignature('tmp', {
            "user-agent": "aws-sdk-nodejs/2.710.0 win32/v14.4.0 callback",
            "content-type": "application/x-amz-json-1.0",
            "x-amz-target": "AWSStepFunctions.ListActivities",
            "x-amz-content-sha256": "61233024385b370ac88291f6e82662bd8047c859dd7e57031ad8ffbc588bd566",
            "content-length": "19",
            "host": "localhost:3000",
            "x-amz-date": "20200722T151326Z",
            "authorization": "AWS4-HMAC-SHA256 Credential=caca/20200722/eu-west/states/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-target, Signature=348c9fdcf9816d9be67d76bc8e724985fdfdd37bceb45091801b8459babaf448",
            "connection": "close"
        });
        expect(result).toBe('348c9fdcf9816d9be67d76bc8e724985fdfdd37bceb45091801b8459babaf448');
    });
});