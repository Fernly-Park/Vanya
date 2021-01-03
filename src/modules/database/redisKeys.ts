import config from "@App/config";

const getLastPartOfKey = (key: string): string => {
    const parts = key.split(':');
    return parts[parts.length - 1];
}

const removePrefixFromKey = (key: string): string => {
    return key.substr(config.redis_prefix.length);
}

export const contextObjectKey = {
    get: (executionArn: string): string => {
        return `${config.redis_prefix}:${executionArn}:contextObject`;
    },
    match: (key: string): boolean => {
       return getLastPartOfKey(key) === 'contextObject';
    }
}

export const stateMachineStateKey = {
    get: (stateMachineArn: string): string => {
        return `${config.redis_prefix}:${stateMachineArn}:states`;
    },
    match: (key: string): boolean => {
        return getLastPartOfKey(key) === 'states';
    }
}

export const executionEventKey = {
    get: (executionArn: string): string => {
        return `${config.redis_prefix}:${executionArn}:events`;
    },
    match: (key: string): boolean => {
        return getLastPartOfKey(key) === 'events';
    }
}

export const executionStatusKey = {
    get: (executionArn: string): string => {
        return `${config.redis_prefix}:${executionArn}:status`;
    },
    match: (key: string): boolean => {
        return getLastPartOfKey(key) === 'status';
    }
}

export const executionCurrentIdKey = {
    get: (executionArn: string): string => {
        return `${config.redis_prefix}:${executionArn}:currentEventId`;
    },
    match: (key: string): boolean => {
        return getLastPartOfKey(key) === 'currentEventId';
    }
}

export const activityTaskKey = {
    get: (activityArn: string): string => {
        return `${config.redis_prefix}:${activityArn}:tasks`;
    },
    match: (key: string): boolean => {
        return getLastPartOfKey(key) === 'tasks';
    }
}

export const runningTaskStateKey = {
    get: (token: string): string => {
        return `${config.redis_prefix}:tasks:${token}`;
    },
    match: (key: string): boolean => {
        const firstElementAfterPrefix = removePrefixFromKey(key).split(':')[1]
        return firstElementAfterPrefix === 'tasks';
    },
    extractToken: (key: string): string => {
        return key.split(':')[3]
    }
}

export const parallelStateInfoKey = {
    get: (parallelKey: string): string => {
        return `${config.redis_prefix}:parallel:${parallelKey}`;
    },
    match: (key: string): boolean => {
        const firstElementAfterPrefix = removePrefixFromKey(key).split(':')[1]
        return firstElementAfterPrefix === 'parallel';
    },
    extractToken: (key: string): string => {
        return key.split(':')[3]
    }
}

export const waitStateKey = {
    get: (token: string): string => {
        return `${config.redis_prefix}:wait:${token}`;
    },
    match: (key: string): boolean => {
        const firstElementAfterPrefix = removePrefixFromKey(key).split(':')[1]
        return firstElementAfterPrefix === 'wait';
    },
    extractToken: (key: string): string => {
        return key.split(':')[3]
    }
}

export const mapStateKey = {
    get: (token: string): string => {
        return `${config.redis_prefix}:Map:${token}`;
    },
    match: (key: string): boolean => {
        const splittedKey = removePrefixFromKey(key).split(':');
        const firstElementAfterPrefix = splittedKey[1];
        return firstElementAfterPrefix === 'Map' && splittedKey.length === 3;
    },
    extractToken: (key: string): string => {
        return key.split(':')[3]
    }
}

export const mapStateRemainingInputKey = {
    get: (token: string): string => {
        return `${config.redis_prefix}:Map:${token}:RemainingInputs`;
    },
    match: (key: string): boolean => {
        const splittedKey = removePrefixFromKey(key).split(':');
        const firstElementAfterPrefix = splittedKey[1];
        return firstElementAfterPrefix === 'Map' && splittedKey.length === 4;
    },
    extractToken: (key: string): string => {
        return key.split(':')[3]
    }
}

export const currentlyRunningStateKey = {
    get: (executionArn: string): string => {
        return `${config.redis_prefix}:${executionArn}:currentlyRunningStates`;
    },
    match: (key: string): boolean => {
        return getLastPartOfKey(key) === 'currentlyRunningStates';
    }
}

export const runningStateInsideParallelKey = {
    get: (parentKey: string): string => {
        return `${config.redis_prefix}:parallel:${parentKey}:currentlyRunningStates`;
    },
    match: (key: string): boolean => {
        const firstElementAfterPrefix = removePrefixFromKey(key).split(':')[1]
        return firstElementAfterPrefix === 'parallel' && getLastPartOfKey(key) === 'currentlyRunningStates';
    }
}
