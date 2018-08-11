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
