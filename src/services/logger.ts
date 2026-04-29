import pino from 'pino';
import pinoPretty from 'pino-pretty';

import config from './config';

const logger = pino({
    level: config.logLevel,
}, config.nodeEnv === 'development'
    ? pinoPretty({ colorize: true })
    : undefined);

export default logger;

/** Truncate a value to a short JSON preview for logging */
export function preview(value: unknown, maxLen = 200): string {
    if (value === undefined || value === null) return String(value);
    try {
        const json = JSON.stringify(value);
        return json.length > maxLen ? json.slice(0, maxLen) + '…' : json;
    } catch {
        return '[unserializable]';
    }
}