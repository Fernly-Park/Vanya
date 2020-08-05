export class BaseError extends Error {
    public readonly name: string;
    public readonly isOperational: boolean;
    
    constructor(name: string, description: string, isOperational: boolean) {
      super(description);
      Object.setPrototypeOf(this, new.target.prototype);
    
      this.name = name;
      this.isOperational = isOperational;
    
      Error.captureStackTrace(this);
    }
   }


export class ResourceAlreadyExistsError extends BaseError {
    constructor(description: string) {
        super("Resource Already Exists", description, true);
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

export class UnexistingResourceError extends BaseError {
    constructor(description: string) {
        super("Unexisting Resource", description, true);
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

export class UserDoesNotExistsError extends BaseError {
    constructor(description: string) {
        super("User Does Not Exists", description, true);
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}

export class InvalidInputError extends BaseError {
    constructor(description: string) {
        super("Invalid Request Input", description, true);
        this.stack = `${this.message}\n${new Error().stack}`;
    }
}


