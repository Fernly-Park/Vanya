import * as express from "express";
import { isAString } from "@App/utils/stringUtils";
import { AWSConstant } from "@App/utils/constants";
import { MissingHeaderError, UnsupportedOperationError } from "@App/errors/AWSErrors";
export const AWSRequestFilterMiddleware =   (req: express.Request, resp: express.Response, next: express.NextFunction): void => {
    const contentType = req.headers['content-type'];
    if (!isAString(contentType) || contentType !== AWSConstant.headers.CONTENT_TYPE) {
      throw new MissingHeaderError(`Content type not set to value '${AWSConstant.headers.CONTENT_TYPE}'`);
    }

    const target = req.headers[AWSConstant.headers.TARGET_HEADER] as string;
    if (!isAString(target)) {
      throw new MissingHeaderError(`Missing Required Header: '${AWSConstant.headers.TARGET_HEADER}'`)
    }
    if (target.split('.').length !== 2) {
      throw new UnsupportedOperationError(`Unsupported Operation: '${target}'`);
    }
    return next();
};