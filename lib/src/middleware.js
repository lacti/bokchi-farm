const logger = require("./logger")(__filename);

class ProxyRequest {
  constructor(event, context) {
    this.event = event;
    this.context = context;
  }
  get body() {
    if (!this.event.body) {
      return {};
    }
    if (this._body === undefined) {
      this._body = JSON.parse(this.event.body);
    }
    return this._body || {};
  }
  get path() {
    return this.event.pathParameters || {};
  }
  get query() {
    return this.event.queryStringParameters || {};
  }
  records(selector = undefined) {
    const target = this.event.Records || [];
    return selector === undefined ? target : target.map(selector);
  }
}

class ProxyResponse {
  constructor(callback) {
    this.callback = callback;
    this.completed = false;
    this.corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    };
  }
  ok(body = {}, code = 200) {
    logger.stupid(`ok`, body);
    const result = this.callback(null, {
      statusCode: code,
      headers: this.corsHeaders,
      body: JSON.stringify(body)
    });
    this.completed = true;
    return result;
  }
  fail(body = {}, code = 500) {
    logger.stupid(`fail`, body);
    const result = this.callback(null, {
      statusCode: code,
      headers: this.corsHeaders,
      body: JSON.stringify(body)
    });
    this.completed = true;
    return result;
  }
}

class ProxyHandler {
  /**
   * @param { (request: ProxyRequest, response: ProxyResponse ) => * } handler
   */
  constructor(handler) {
    this.handler = handler;
  }
  delegate(event, context, callback) {
    logger.stupid(`event`, event);
    const request = new ProxyRequest(event, context);
    const response = new ProxyResponse(callback);
    try {
      const result = this.handler(request, response);
      logger.stupid(`result`, result);
      if (response.completed || !result) {
        return result;
      }
      return result.constructor.name !== "Promise"
        ? response.ok(result)
        : result
            .then(result => response.ok(result))
            .catch(err => response.fail(err));
    } catch (err) {
      logger.error(err);
      return response.fail(err);
    }
  }
}

/**
 * @param { (request: ProxyRequest, response: ProxyResponse ) => * } handler
 */
const middleware = handler => {
  const proxy = new ProxyHandler(handler);
  return (event, context, callback) => proxy.delegate(event, context, callback);
};

/**
 * @param { ( env: {} ) => { [name: string]: () => Promise<boolean> } } mapper
 */
const initialize = mapper =>
  middleware(async request => {
    // Do nothing on production stage.
    if (process.env.STAGE === "prod") {
      return { ok: true };
    }
    const env = process.env;
    const mapping = mapper(env);
    const successes = await Promise.all(
      Object.keys(mapping).map(name => mapping[name]())
    );
    return Object.keys(mapping).reduce(
      (result, name, index) =>
        Object.assign(result, { [name]: successes[index] }),
      {}
    );
  });

module.exports = {
  middleware,
  initialize
};
