const PREFIX = '[PinkDrive]';

const logger = {
  info: (...args) => {
    if (import.meta.env.DEV) {
      console.info(PREFIX, ...args);
    }
  },
  warn: (...args) => {
    if (import.meta.env.DEV) {
      console.warn(PREFIX, ...args);
    }
  },
  error: (...args) => {
    console.error(PREFIX, ...args);
  },
  debug: (...args) => {
    if (import.meta.env.DEV) {
      console.debug(PREFIX, ...args);
    }
  },
};

export default logger;
