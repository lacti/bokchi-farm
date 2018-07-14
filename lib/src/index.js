const getLogger = require("./logger");
const aws = require("./aws");
const { middleware, initialize } = require("./middleware");

module.exports = {
  getLogger,
  aws,
  middleware,
  initialize
};
