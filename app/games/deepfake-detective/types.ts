export interface ImagePair {
  id: number;
  realImage: string;
  fakeImage: string;
}

export interface RoundData {
  leftImage: string;
  rightImage: string;
  leftIsFake: boolean;
  pairId: number;
}

export interface GameState {
  round: number;
  stonks: number;
  currentRoundData: RoundData | null;
  gameOver: boolean;
  selectedSide: 'left' | 'right' | null;
  showFeedback: boolean;
}
