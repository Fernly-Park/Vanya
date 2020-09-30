import db, { DbOrTransaction } from "@App/modules/database/db";
import { ListStateMachinesInput, ListActivitiesInput } from "aws-sdk/clients/stepfunctions";
import { ensureListResourceInputAreValid } from "@App/utils/validationHelper";
import { LIST_RESOURCE_DEFAULT_RESULT } from "@App/utils/constants";
import * as Logger from '@App/modules/logging';
import { InvalidTokenError } from "@App/errors/AWSErrors";

export const listResourcesFactory = <T>(countResource: (db: DbOrTransaction) => Promise<number>, 
                              selectResources: (db: DbOrTransaction, limit: number, offset: number) => Promise<T[]>) => {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    return async (req?: ListActivitiesInput | ListStateMachinesInput) => {
        ensureListResourceInputAreValid(req);
        const { maxResults, nextToken } = req || {};

        const limit = maxResults ?? LIST_RESOURCE_DEFAULT_RESULT;
        const offset = nextToken ? +nextToken : 0;

        const numberOfRecord = await countResource(db);

        if (nextToken && offset >= numberOfRecord) {
            throw new InvalidTokenError(nextToken);
        }

        const result = await selectResources(db, limit, offset);
        
        const nextTokenToReturn: string = limit + offset >= numberOfRecord ? null: (limit + offset).toString();

        Logger.logDebug(`sending '${result.length}' resources`);

        return {
            resources: result,
            nextToken: nextTokenToReturn
        };
    };
}