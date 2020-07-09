import { BaseError } from "./customErrors";

export class MissingHeaderError extends BaseError {
    constructor(description: string) {
        super("Invalid Request Input", description, true);
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

export class UnsupportedOperationError extends BaseError {
    constructor(description: string) {
        super("Unsupported Operation", description, true);
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}
