const severity = level => {
  switch (level) {
    case "error":
      return 100;
    case "warn":
      return 200;
    case "info":
      return 300;
    case "debug":
      return 400;
    case "verbose":
      return 500;
    case "silly":
      return 600;
    case "stupid":
      return 700;
    default:
      return 1000;
  }
};

const currentLevel = () =>
  process.env.LOG_LEVEL || (process.env.STAGE === "prod" ? "stupid" : "stupid");

class Logger {
  /**
   * @param {string} name
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * @param {string} level
   * @param {string} message
   * @returns {string} message
   */
  log(level, message) {
    if (severity(currentLevel()) >= severity(level)) {
      console.log(
        `[${new Date().toISOString()}][${level.toUpperCase()}] ${message}`
      );
    }
    return message;
  }

  error(message) {
    return this.log("error", message);
  }
  warn(message) {
    return this.log("warn", message);
  }
  info(message) {
    return this.log("info", message);
  }
  debug(message) {
    return this.log("debug", message);
  }
  verbose(message) {
    return this.log("verbose", message);
  }
  silly(message) {
    return this.log("silly", message);
  }

  /**
   * @template T
   * @param {string} message
   * @param {T} object
   * @param {(key: string, value: T) => *} replacer
   * @returns {T} object
   */
  stupid(message, object, replacer = null) {
    this.log("stupid", `${message}: ${JSON.stringify(object, replacer)}`);
    return object;
  }
}

/**
 * @type { { [name: string]: Logger } }
 */
const loggers = {};

/**
 * @param {string} name
 * @returns {Logger}
 */
module.exports = name => {
  if (loggers[name] === undefined) {
    loggers[name] = new Logger(name);
  }
  return loggers[name];
};
