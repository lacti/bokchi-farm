import { getLogger, SimpleAWS } from 'serverless-simple-middleware';
import { fireCost, maxX, maxY } from './constant';
import {
  ActionHandler,
  ActionMessage,
  ActionType,
  Farm,
  Farms,
  FireAction,
  Game,
  Games,
  GreenAction,
  TileState,
  WaterAction,
} from './model';

const logger = getLogger(__filename);

const games: Games = {};
const farms: Farms = {};

export const load = async (aws: SimpleAWS, messages: ActionMessage[]) => {
  // Please make me to process them in bulk.
  try {
    for (const message of messages) {
      const { gameId, userId } = message;
      if (!games[gameId]) {
        games[gameId] = (await aws.getDynamoDbItem(process.env.GAME_TABLE, {
          GameId: gameId,
        })) as Game;
      }
      if (!farms[userId]) {
        farms[userId] = (await aws.getDynamoDbItem(process.env.FARM_TABLE, {
          UserId: userId,
        })) as Farm;
      }
    }
    for (const game of Object.values(games)) {
      for (const userId of game.UserIds) {
        if (!farms[userId]) {
          farms[userId] = (await aws.getDynamoDbItem(process.env.FARM_TABLE, {
            UserId: userId,
          })) as Farm;
        }
      }
    }
  } catch (err) {
    logger.error(err);
  }
  logger.stupid(`games`, games);
  logger.stupid(`farms`, farms);
};

const actGreen: ActionHandler<ActionType.Green> = (
  farm: Farm,
  action: GreenAction,
) => {
  for (const each of farm.Ground) {
    if (each.X === action.x && each.Y === action.y) {
      each.State = TileState.Green;
      each.Value = action.value;
      break;
    }
  }
};

const actFire: ActionHandler<ActionType.Fire> = (
  farm: Farm,
  action: FireAction,
) => {
  const gameId = farm.GameId;
  const attackerId = farm.UserId;

  if (farm.Money < fireCost) {
    logger.info(`No money[${farm.Money}] in user[${farm.UserId}]`);
    return;
  }

  const game = games[gameId];
  if (!game) {
    logger.info(`No game for [${game.GameId}]`);
    return;
  }
  if (!game.UserIds || game.UserIds.length <= 1) {
    logger.info(`No users in game[${game.GameId}]`);
    return;
  }
  const randomInt = (max: number) => Math.floor(Math.random() * max);
  let targetUserId = game.UserIds[randomInt(game.UserIds.length)];
  while (targetUserId === attackerId) {
    targetUserId = game.UserIds[randomInt(game.UserIds.length)];
  }

  const targetFarm = farms[targetUserId];
  if (!targetFarm) {
    logger.info(`Invalid farm for target user[${targetUserId}]`);
    return;
  }
  const randomPosX = randomInt(maxX);
  const randomPosY = randomInt(maxY);
  for (const each of targetFarm.Ground) {
    if (each.X === randomPosX && each.Y === randomPosY) {
      each.State = TileState.Fire;
      each.Value = action.value;
      return;
    }
  }
};

const actWater: ActionHandler<ActionType.Water> = (
  farm: Farm,
  action: WaterAction,
) => {
  for (const each of farm.Ground) {
    if (each.X === action.x && each.Y === action.y) {
      if (each.State === 'Fire') {
        if (each.Value <= action.value) {
          each.State = TileState.Green;
          each.Value = 0;
        } else {
          each.State = TileState.Fire;
          each.Value -= action.value;
        }
      }
      break;
    }
  }
};

const acts = {
  [ActionType.Green]: actGreen,
  [ActionType.Fire]: actFire,
  [ActionType.Water]: actWater,
};

const getAct = <T extends ActionType>(type: T): ActionHandler<T> => {
  const act = acts[type] as ActionHandler<T>;
  if (!act) {
    throw new Error(`No act for type: ${type}`);
  }
  return act;
};

export const execute = (message: ActionMessage) => {
  try {
    if (!message) {
      logger.verbose(`Invalid message`);
      return;
    }

    logger.verbose(`message: ${JSON.stringify(message, null, 2)}`);
    const { userId, action } = message;
    if (!action) {
      logger.info(`No action for message: ${JSON.stringify(message)}`);
      return;
    }
    const farm = farms[userId];
    if (!farm) {
      logger.info(`No farm for message: ${JSON.stringify(message)}`);
      return;
    }

    getAct(action.type)(farm, action);
  } catch (err) {
    logger.warn(err);
  }
};

export const getState = () => ({ games, farms });

const spreadFire = (farm: Farm, x: number, y: number) => {
  if (x < 0 || y < 0 || x >= maxX || y >= maxY) {
    return;
  }
  const tile = farm.Ground.find(each => each.X === x && each.Y === y);
  if (!tile) {
    return;
  }
  switch (tile.State) {
    case 'Green':
      tile.State = TileState.Fire;
      tile.Value = 0;
      break;
    case 'Fire':
      tile.Value++;
      break;
  }
};

const tickOne = (farm: Farm) => {
  let money = farm.Money;
  for (const each of farm.Ground) {
    logger.stupid(`each tile on tick`, each);
    switch (each.State) {
      case 'Green':
        money += Math.pow(10, each.Value);
        logger.stupid(`money`, money);
        break;
      case 'Fire':
        money -= 5 * (each.Value + 1);
        break;
    }
  }
  farm.Money = money;

  for (const each of farm.Ground) {
    switch (each.State) {
      case 'Fire':
        spreadFire(farm, each.X, each.Y);
        spreadFire(farm, each.X - 1, each.Y);
        spreadFire(farm, each.X, each.Y - 1);
        spreadFire(farm, each.X + 1, each.Y);
        spreadFire(farm, each.X, each.Y + 1);
        break;
    }
  }
  if (farm.Money < 0) {
    for (const each of farm.Ground) {
      switch (each.State) {
        case 'Fire':
          each.State = TileState.Green;
          each.Value = 0;
          break;
      }
    }
    farm.Money = 0;
  }
  logger.stupid(`farm`, farm);
};

export const tick = () => {
  for (const farm of Object.values(farms)) {
    tickOne(farm);
  }
};
