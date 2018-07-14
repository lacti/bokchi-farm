const { aws, getLogger } = require('serverless-base-library');
const { maxX, maxY, fireCost } = require('./constant');
const logger = getLogger(__filename);

/** @type { {[GameId: string]: {GameId: string, AgeValue: number, UserIds: string[]}} } */
const games = {};

/** @type { {[UserId: string]: {UserId: string, GameId: string, Money: number, Ground: [{X: number, Y: number, State: 'Green' | 'Fire', Value: number}]}} } */
const farms = {};

/**
 * @param { [{gameId: string, userId: string, action: {}}] } messages
 */
module.exports.load = async messages => {
  // Please make me to process them in bulk.
  try {
    for (const message of messages) {
      const { gameId, userId } = message;
      if (!games[gameId]) {
        games[gameId] = await aws.getDynamoDbItem(process.env.GAME_TABLE, {
          GameId: gameId,
        });
      }
      if (!farms[userId]) {
        farms[userId] = await aws.getDynamoDbItem(process.env.FARM_TABLE, {
          UserId: userId,
        });
      }
    }
    for (const game of Object.values(games)) {
      for (const userId of game.UserIds) {
        if (!farms[userId]) {
          farms[userId] = await aws.getDynamoDbItem(process.env.FARM_TABLE, {
            UserId: userId,
          });
        }
      }
    }
  } catch (err) {
    logger.error(err);
  }
  logger.stupid(`games`, games);
  logger.stupid(`farms`, farms);
};

/**
 * @param { {UserId: string, GameId: string, Money: number, Ground: [{X: number, Y: number, State: 'Green' | 'Fire', Value: number}]} } farm
 * @param { {type: 'green', x: number, y: number, value: number}} } action
 */
const actGreen = (farm, action) => {
  for (const each of farm.Ground) {
    if (each.X === action.x && each.Y === action.y) {
      each.State = 'Green';
      each.Value = action.value;
      break;
    }
  }
};

/**
 * @param { {UserId: string, GameId: string, Money: number, Ground: [{X: number, Y: number, State: 'Green' | 'Fire', Value: number}]} } farm
 * @param { {type: 'fire', x: number, y: number, value: number}} } action
 */
const actFire = (farm, action) => {
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
  const randomInt = max => Math.floor(Math.random() * max);
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
      each.State = 'Fire';
      each.Value = action.value;
      return;
    }
  }
};

/**
 * @param { {UserId: string, GameId: string, Money: number, Ground: [{X: number, Y: number, State: 'Green' | 'Fire', Value: number}]} } farm
 * @param { {type: 'water', x: number, y: number, value: number}} } action
 */
const actWater = (farm, action) => {
  for (const each of farm.Ground) {
    if (each.X === action.x && each.Y === action.y) {
      if (each.State === 'Fire') {
        if (each.value <= action.value) {
          each.State = 'Green';
          each.Value = 0;
        } else {
          each.State = 'Fire';
          each.Value -= action.value;
        }
      }
      break;
    }
  }
};

const acts = {
  green: actGreen,
  fire: actFire,
  water: actWater,
};

/**
 * @param { {gameId: string, userId: string, action: {type: 'green' | 'fire' | 'water', x: number, y: number, value: number}} } message
 */
module.exports.process = message => {
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

    const act = acts[action.type];
    if (!act) {
      logger.info(`No act for message: ${JSON.stringify(message)}`);
      return;
    }
    act(farm, action);
  } catch (err) {
    logger.warn(err);
  }
};

module.exports.getState = () => ({ games, farms });

/**
 * @param { {UserId: string, GameId: string, Money: number, Ground: [{X: number, Y: number, State: 'Green' | 'Fire', Value: number}]} } farm
 * @param {number} x
 * @param {number} y
 */
const spreadFire = (farm, x, y) => {
  if (x < 0 || y < 0 || x >= maxX || y >= maxY) {
    return;
  }
  const tile = farm.Ground.find(each => each.X === x && each.Y === y);
  if (!tile) {
    return;
  }
  switch (tile.State) {
    case 'Green':
      tile.State = 'Fire';
      tile.Value = 0;
      break;
    case 'Fire':
      tile.Value++;
      break;
  }
};
/**
 * @param { {UserId: string, GameId: string, Money: number, Ground: [{X: number, Y: number, State: 'Green' | 'Fire', Value: number}]} } farm
 */
const tickOne = farm => {
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
          each.State = 'Green';
          each.Value = 0;
          break;
      }
    }
    farm.Money = 0;
  }
  logger.stupid(`farm`, farm);
};

module.exports.tick = () => {
  for (const farm of Object.values(farms)) {
    tickOne(farm);
  }
};
