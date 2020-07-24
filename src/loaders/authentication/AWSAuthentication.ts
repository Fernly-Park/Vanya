// https://docs.aws.amazon.com/general/latest/gr/sigv4_signing.html
import crypto from 'crypto';
import * as UserService from '@App/components/user/userService';
import { IUser } from '@App/components/user/user.interfaces';

const signingAlgorithm = 'sha256';
const serviceName = 'states';
const v4Identifier = 'aws4_request';

type Header = {[headerName: string]: string};

export const checkAWSSignature = async (headers: Header): Promise<IUser> => {
    console.log('helloo');
    if (!headers['authorization']) {
        return null;
    }

    const authorizationDatas = parseAuthorizationHeader(headers['authorization'])
    const user = await UserService.retrieveUserById(authorizationDatas.userId);
    if (!user || !user.secret) {
        return null;
    }
    const generatedSignature = generateAWSSignature(user.secret, headers);
    return authorizationDatas.signature === generatedSignature ? user : null;
}

const generateAWSSignature = (userSecretKey: string, headers: Header): string => {
    const date = headers['x-amz-date'];
    const authorizationDatas = parseAuthorizationHeader(headers['authorization'])
    
    const signedHeaders = retrieveSignedHeaders(authorizationDatas.signedHeadersConcatenated, headers);
    const signingKey = generateSigningKey(userSecretKey, date.substr(0, 8), authorizationDatas.region);
    const stringToSign = generateStringToSign(date, authorizationDatas.region, authorizationDatas.signedHeadersConcatenated, signedHeaders);

    return crypto.createHmac(signingAlgorithm, signingKey).update(stringToSign).digest('hex');
}

const parseAuthorizationHeader = (authorization: string) => {
    const authorizationParts = authorization.split(',');
    const signaturePart = authorizationParts[2];
    const credentialsPart = authorizationParts[0];
    const signedHeadersPart = authorizationParts[1];
    const credentials = credentialsPart.split('=')[1].split('/');

    return {
        signature: signaturePart.split('=')[1],
        signedHeadersConcatenated: signedHeadersPart.split('=')[1],
        region: credentials[2],
        userId: credentials[0]
    };
}

const retrieveSignedHeaders = (signedHeaders: string, headers: Header): Header => {
    const toReturn: Header  = {};
    signedHeaders.split(';').forEach(header => {
        toReturn[header] = headers[header];
    });

    return toReturn;
};

const generateSigningKey = (secretKey: string, date: string, region: string): Buffer => {
    const hashedDate = crypto.createHmac(signingAlgorithm, 'AWS4' + secretKey).update(date).digest();
    const hashedRegion = crypto.createHmac(signingAlgorithm, hashedDate).update(region).digest();
    const hashedService = crypto.createHmac(signingAlgorithm, hashedRegion).update(serviceName).digest();
    const signingKey = crypto.createHmac(signingAlgorithm, hashedService).update(v4Identifier).digest();
    
    return signingKey;
};

const generateStringToSign = (datetime: string, region: string, concatenatedSignedHeader: string, signedHeaders: Header) => {
    const canonicalString = generateCanoncialString(concatenatedSignedHeader, signedHeaders);
    const sha256Hash = crypto.createHash('sha256');
    const parts: string[] = [];
    parts.push('AWS4-HMAC-SHA256');
    parts.push(datetime);
    parts.push(generateCredentialString(region, datetime));
    parts.push(sha256Hash.update(canonicalString).digest('hex'))
    return parts.join('\n');
}

const generateCredentialString = (region: string, datetime: string) => {
    return [
        datetime.substr(0, 8),
        region,
        serviceName,
        v4Identifier
    ].join('/');
}

const generateCanoncialString = (concatenatedSignedHeader: string, signedHeaders: Header): string => {
    const parts: string[] = [];

    parts.push('POST');
    parts.push('/');
    parts.push('')
    parts.push(`${constructCanonicalHeaders(signedHeaders)}\n`);
    parts.push(concatenatedSignedHeader)
    parts.push(signedHeaders['x-amz-content-sha256'].toString());
    return parts.join('\n');
}


const constructCanonicalHeaders = (signedHeaders: Header): string => {
    const correctlyFormedHeaders: [string, string][] = [];

    for (const [headerName, headerValue] of Object.entries(signedHeaders)) {
        const correctlyFormedHeaderName = headerName.toLowerCase().trim();
        const correctlyFormedHeaderValues = headerValue.trim();
        const correctlyFormedHeader: [string, string] = [correctlyFormedHeaderName, correctlyFormedHeaderValues];
        correctlyFormedHeaders.push(correctlyFormedHeader);
    }

    correctlyFormedHeaders.sort((a, b) => a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1);

    const toReturn: string[] = [];
    correctlyFormedHeaders.forEach(header => {
        const headerName = header[0];
        const headerValue = header[1];
        toReturn.push(`${headerName}:${canonicalHeaderValue(headerValue.toString())}`);

    });
    return toReturn.join('\n');
}

const canonicalHeaderValue = (values: string) => {
    return values.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
};