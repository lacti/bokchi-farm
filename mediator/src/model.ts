export interface Game {
  GameId: string;
  AgeValue: number;
  UserIds: string[];
}

export interface Games {
  [GameId: string]: Game;
}

export enum TileState {
  Green = 'Green',
  Fire = 'Fire',
}

export interface Tile {
  X: number;
  Y: number;
  State: TileState;
  Value: number;
}

export type Ground = Tile[];

export interface Farm {
  UserId: string;
  GameId: string;
  Money: number;
  Ground: Ground;
}

export interface Farms {
  [UserId: string]: Farm;
}

export enum ActionType {
  Green = 'green',
  Fire = 'fire',
  Water = 'water',
}

export interface Action<T extends ActionType> {
  type: T;
}

interface SimpleTargetAction<T extends ActionType> extends Action<T> {
  x: number;
  y: number;
  value: number;
}

export interface GreenAction extends SimpleTargetAction<ActionType.Green> {}

export interface FireAction extends SimpleTargetAction<ActionType.Fire> {}

export interface WaterAction extends SimpleTargetAction<ActionType.Water> {}

export interface ActionMessage {
  gameId: string;
  userId: string;
  action: GreenAction | FireAction | WaterAction;
}

export type ActionHandler<T extends ActionType> = (
  farm: Farm,
  action: Action<T>,
) => void;
