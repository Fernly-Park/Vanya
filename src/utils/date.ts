import config from "@App/config";

export const getDateIn = (ms: number, scale?: number): Date => {
    const until = new Date();
    scale = scale ?? config.waitScale;
    until.setMilliseconds(until.getMilliseconds() + (ms * scale));
    return until;
}