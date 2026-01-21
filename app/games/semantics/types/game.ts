// Type definitions for the Semantic Clear game

export interface Word {
  id: number;
  text: string;
  x: number;
  y: number;
}

export interface SemanticSimilarityHook {
  isLoading: boolean;
  progress: number;
  error: string | null;
  calculateSimilarity: (text1: string, text2: string) => Promise<number>;
}

export interface GameOverProps {
  score: number;
  onRestart: () => void;
}

export interface LoadingScreenProps {
  progress: number;
}

export interface FallingWordProps {
  word: Word;
}
