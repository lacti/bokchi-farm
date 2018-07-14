const { aws, getLogger, middleware } = require('serverless-base-library');
const logger = getLogger(__filename);

const globalGameId = '00000000-0000-0000-0000000000000000';

module.exports.act = middleware(async request => {
  logger.info(`[${request.path.key}] ${JSON.stringify(request.body, null, 2)}`);
  await aws.enqueue(process.env.TASK_QUEUE, {
    id: request.path.key,
    action: request.body,
  });
  return { code: 200 };
});

module.exports.see = middleware(async request => {
  logger.info(`[${request.path.key}] Age: ${request.body.age}`);
  const age = await aws.getDynamoDbItem(process.env.AGE_TABLE, {
    GameId: globalGameId,
  });
  if (age.value === request.body.age) {
    return {};
  }
  const farm = await aws.getDynamoDbItem(process.env.FARM_TABLE, {
    UserId: request.path.key,
  });
  return farm;
});

module.exports.tick = middleware(async request => {
  while (true) {
    const messages = await aws.dequeue(process.env.TASK_QUEUE, 10, 0);
    if (!messages || messages.length === 0) {
      break;
    }

    logger.stupid(`messages`, messages);
    for (const message of messages) {
      await aws.complete(process.env.TASK_QUEUE, message.handle);
    }
  }
  return {};
});
