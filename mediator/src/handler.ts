import {
  AWSHandlerPluginRequestAux,
  getLogger,
  HandlerRequest,
  HandlerResponse,
  middleware,
  SQSMessageBody,
} from 'serverless-simple-middleware';
import { v4 as uuid4 } from 'uuid';
import { maxX, maxY } from './constant';
import * as logic from './logic';
import { ActionMessage, Game } from './model';

const logger = getLogger(__filename);

type Aux = AWSHandlerPluginRequestAux;
const handler = middleware.build<Aux>([middleware.aws()]);

export const init = handler(
  async (request: HandlerRequest, response: HandlerResponse, aux: Aux) => {
    const { aws } = aux;
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
  },
);

const generateGround = () => {
  const ground = [];
  for (let x = 0; x < maxX; x++) {
    for (let y = 0; y < maxY; y++) {
      ground.push({ X: x, Y: y, State: 'Green', Value: 0 });
    }
  }
  return ground;
};

export const start = handler(
  async (request: HandlerRequest, response: HandlerResponse, aux: Aux) => {
    const { aws } = aux;
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
  },
);

export const act = handler(
  async (request: HandlerRequest, response: HandlerResponse, aux: Aux) => {
    const { aws } = aux;
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
  },
);

export const see = handler(
  async (request: HandlerRequest, response: HandlerResponse, aux: Aux) => {
    const { aws } = aux;
    const { gameId, userId } = request.path;
    const { age } = request.body;
    logger.info(`[${gameId}][${userId}] Age: ${age}`);
    const game = (await aws.getDynamoDbItem(process.env.GAME_TABLE, {
      GameId: gameId,
    })) as Game;
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
  },
);

export const tick = handler(
  async (request: HandlerRequest, response: HandlerResponse, aux: Aux) => {
    const { aws } = aux;
    const messages: Array<SQSMessageBody<ActionMessage>> = [];
    while (true) {
      const eachOfMessages = await aws.dequeue<ActionMessage>(
        process.env.TASK_QUEUE,
        10,
        0,
      );
      if (!eachOfMessages || eachOfMessages.length === 0) {
        break;
      }
      for (const each of eachOfMessages) {
        messages.push(each);
      }
    }
    logger.stupid(`messages`, messages);

    await logic.load(aws, messages.map(each => each.body));
    for (const message of messages) {
      // process
      logic.execute(message.body);
      await aws.completeMessage(process.env.TASK_QUEUE, message.handle);
    }
    logic.tick();

    // update each state
    const { games, farms } = logic.getState();
    const newAge = new Date().getTime();
    for (const gameId of Object.keys(games)) {
      const game = games[gameId];
      game.AgeValue = newAge;

      const copy = { ...game };
      delete copy.GameId;
      await aws.updateDynamoDbItem(
        process.env.GAME_TABLE,
        { GameId: gameId },
        copy,
      );
    }
    for (const userId of Object.keys(farms)) {
      const farm = farms[userId];

      const copy = { ...farm };
      delete copy.UserId;
      await aws.updateDynamoDbItem(
        process.env.FARM_TABLE,
        { UserId: userId },
        copy,
      );
    }

    return {
      age: newAge,
    };
  },
);
