/**
 * AI Scribble - Target Words List
 * Curated list of drawable words for the Reverse Pictionary game
 */

export const WORD_CATEGORIES = {
  animals: [
    "cat", "dog", "elephant", "giraffe", "penguin", 
    "butterfly", "fish", "bird", "snake", "turtle"
  ],
  objects: [
    "house", "car", "tree", "sun", "moon", 
    "umbrella", "key", "book", "clock", "guitar"
  ],
  food: [
    "pizza", "apple", "banana", "cake", "ice cream",
    "hamburger", "coffee", "carrot", "watermelon", "cheese"
  ],
  nature: [
    "mountain", "flower", "cloud", "star", "rainbow",
    "beach", "forest", "river", "volcano", "lightning"
  ]
} as const;

export function getRandomWord(): string {
  const categories = Object.values(WORD_CATEGORIES);
  const allWords = categories.flat();
  return allWords[Math.floor(Math.random() * allWords.length)];
}

export function getRandomWordFromCategory(category: keyof typeof WORD_CATEGORIES): string {
  const words = WORD_CATEGORIES[category];
  return words[Math.floor(Math.random() * words.length)];
}
