import { BaseError } from "./customErrors";



export class AWSError extends BaseError {
    type: string;

    constructor(name: string, description: string, type: string) {
        super(name, description, true);
        this.type = type;
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

export class MissingHeaderError extends AWSError {
    constructor(description: string) {
        super("Missing Required Header", description, 'com.amazonaws.swf.service.v2.model#MissingRequiredHeader');
    }
}

export class UnsupportedOperationError extends AWSError {
    constructor(description: string) {
        super("Unsupported Operation", description, "com.amazonaws.swf.service.v2.model#UnsupportedOperation");
    }
}

export class InvalidDefinitionError extends AWSError {
    constructor(description: string) {
        super("Invalid State Machine Definition", description, 'com.amazonaws.swf.service.v2.model#InvalidDefinition');
    }
}

export class InvalidNameError extends AWSError {
    constructor(description: string) {
        super("Invalid Name", description, "com.amazonaws.swf.service.v2.model#InvalidName");
    }
}

export class InvalidArnError extends AWSError {
    constructor(description: string) {
        super("Invalid Arn", description, "com.amazonaws.swf.service.v2.model#InvalidArn");
    }
}

export class InvalidTokenError extends AWSError {
    constructor(description: string) {
        super("Invalid Token", description, "com.amazonaws.swf.service.v2.model#InvalidToken");
    }   
}

export class StateMachineAlreadyExistsError extends AWSError {
    constructor(description: string) {
        super("State Machine Already Exists", description, "com.amazonaws.swf.service.v2.model#StateMachineAlreadyExists");
    }
}

export class StateMachineDoesNotExistsError extends AWSError {
    constructor(description: string) {
        super("State Machine Does Not Exist", description, "com.amazonaws.swf.service.v2.model#StateMachineDoesNotExist");
    }
}

export class StateMachineTypeNotSupported extends AWSError {
    constructor(description: string) {
        super("State Machine Type Not Supported", description, "com.amazonaws.swf.service.v2.model#StateMachineTypeNotSupported");
    }
}