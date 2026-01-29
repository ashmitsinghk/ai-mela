export interface GameEntry {
  id: number;
  image: string;
  prompt: string;
}

export interface RoundData {
  correctEntry: GameEntry;
  options: string[];
  correctAnswer: string;
}

export interface GameState {
  round: number;
  stonks: number;
  currentRoundData: RoundData | null;
  gameOver: boolean;
  selectedAnswer: string | null;
  showFeedback: boolean;
}
