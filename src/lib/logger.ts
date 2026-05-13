const debugEnabled =
  process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true' ||
  process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

type LogArgs = unknown[];

export const logger = {
  debug: (...args: LogArgs) => {
    if (debugEnabled) console.debug(...args);
  },
  info: (...args: LogArgs) => {
    if (debugEnabled) console.info(...args);
  },
  warn: (...args: LogArgs) => {
    console.warn(...args);
  },
  error: (...args: LogArgs) => {
    console.error(...args);
  },
};
