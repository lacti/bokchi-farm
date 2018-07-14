const uuid4 = require('uuid/v4');
const { aws, getLogger, middleware } = require('serverless-base-library');
const logic = require('./logic');
const { maxX, maxY } = require('./constant');
const logger = getLogger(__filename);

module.exports.init = middleware(async request => {
  const { gameId } = request.path;
  logger.info(`[${gameId}] Initialize a new game`);
  await aws.updateDynamoDbItem(
    process.env.GAME_TABLE,
    { GameId: gameId },
    {
      AgeValue: 0,
      UserIds: [],
    },
  );
  return { gameId };
});

const generateGround = () => {
  const ground = [];
  for (let x = 0; x < maxX; x++) {
    for (let y = 0; y < maxY; y++) {
      ground.push({ X: x, Y: y, State: 'Green', Value: 0 });
    }
  }
  return ground;
};

module.exports.start = middleware(async request => {
  const { gameId } = request.path;
  const userId = uuid4();
  logger.info(`[${gameId}][${userId}] Start a new user`);
  await aws.dynamodb
    .update({
      TableName: process.env.GAME_TABLE,
      Key: { GameId: gameId },
      UpdateExpression: 'SET #users = list_append(#users, :newUser)',
      ExpressionAttributeNames: { '#users': 'UserIds' },
      ExpressionAttributeValues: { ':newUser': [userId] },
    })
    .promise();
  await aws.updateDynamoDbItem(
    process.env.FARM_TABLE,
    {
      UserId: userId,
    },
    {
      GameId: gameId,
      Money: 0,
      Ground: generateGround(),
    },
  );
  return { gameId, userId };
});

module.exports.act = middleware(async request => {
  const { gameId, userId } = request.path;
  logger.info(
    `[${gameId}][${userId}] ${JSON.stringify(request.body, null, 2)}`,
  );
  await aws.enqueue(process.env.TASK_QUEUE, {
    gameId,
    userId,
    action: request.body,
  });
  return { code: 200 };
});

module.exports.see = middleware(async request => {
  const { gameId, userId } = request.path;
  const { age } = request.body;
  logger.info(`[${gameId}][${userId}] Age: ${age}`);
  const game = await aws.getDynamoDbItem(process.env.GAME_TABLE, {
    GameId: gameId,
  });
  if (game.AgeValue === age) {
    return { age: game.AgeValue };
  }
  const farm = await aws.getDynamoDbItem(process.env.FARM_TABLE, {
    UserId: userId,
  });
  return {
    age: game.AgeValue,
    farm,
  };
});

module.exports.tick = middleware(async () => {
  /** @type { [{gameId: string, userId: string, action: {}}] } */
  const messages = [];
  while (true) {
    const eachOfMessages = await aws.dequeue(process.env.TASK_QUEUE, 10, 0);
    if (!eachOfMessages || eachOfMessages.length === 0) {
      break;
    }
    for (const each of eachOfMessages) {
      messages.push(each);
    }
  }
  logger.stupid(`messages`, messages);

  await logic.load(messages.map(each => each.body));
  for (const message of messages) {
    // process
    logic.process(message.body);
    await aws.complete(process.env.TASK_QUEUE, message.handle);
  }
  logic.tick();

  // update each state
  const { games, farms } = logic.getState();
  const newAge = new Date().getTime();
  for (const gameId of Object.keys(games)) {
    const game = games[gameId];
    game.AgeValue = newAge;

    const copy = Object.assign({}, game);
    delete copy['GameId'];
    await aws.updateDynamoDbItem(
      process.env.GAME_TABLE,
      { GameId: gameId },
      copy,
    );
  }
  for (const userId of Object.keys(farms)) {
    const farm = farms[userId];

    const copy = Object.assign({}, farm);
    delete copy['UserId'];
    await aws.updateDynamoDbItem(
      process.env.FARM_TABLE,
      { UserId: userId },
      copy,
    );
  }

  return {
    age: newAge,
  };
});
