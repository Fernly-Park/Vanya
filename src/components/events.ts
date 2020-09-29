import { EventEmitter } from 'events';

export const eventEmitter = new EventEmitter();

export enum CustomEvents {
    StartListeningToEvents = 'StartListeningToEvents',
    StopListeningToEvents = 'StopListeningToEvents',
    ActivityTaskSucceeded = 'ActivityTaskSucceeded'
}

export const startListeningToEvents = (): void => {
    eventEmitter.emit(CustomEvents.StartListeningToEvents);
}

export const stopListeningToEvents = (): void => {
    eventEmitter.emit(CustomEvents.StopListeningToEvents);
}

