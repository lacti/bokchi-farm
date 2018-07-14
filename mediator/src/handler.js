const { aws, getLogger, middleware } = require('serverless-base-library');
const logger = getLogger(__filename);

module.exports.hello = middleware(async request => {
  logger.info('hi there');
  aws.enqueue(process.env.TASK_QUEUE, {
    action: 'hello world',
  });
  return 'hello world';
});
/*
module.exports.ticker = middleware(async request => {
  logger.info('hi there');
  return 'hello world';
});
*/
