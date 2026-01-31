/**
 * AI Scribble - Target Words List
 * Curated list of drawable words for the Reverse Pictionary game
 */

export const WORD_CATEGORIES = {
  animals: [
    "cat", "dog", "elephant", "giraffe", "penguin",
    "butterfly", "fish", "bird", "snake", "turtle",
    "lion", "tiger", "bear", "zebra", "monkey",
    "kangaroo", "panda", "frog", "shark", "whale",
    "octopus", "spider", "rabbit", "dragon", "unicorn"
  ],
  objects: [
    "house", "car", "tree", "sun", "moon",
    "umbrella", "key", "book", "clock", "guitar",
    "pencil", "chair", "table", "computer", "phone",
    "camera", "shoes", "hat", "glasses", "backpack",
    "bicycle", "train", "plane", "boat", "rocket"
  ],
  food: [
    "pizza", "apple", "banana", "cake", "ice cream",
    "hamburger", "coffee", "carrot", "watermelon", "cheese",
    "bread", "cookie", "donut", "grape", "lemon",
    "orange", "strawberry", "tomato", "potato", "popcorn",
    "sushi", "sandwich", "taco", "chocolate", "egg"
  ],
  nature: [
    "mountain", "flower", "cloud", "star", "rainbow",
    "beach", "forest", "river", "volcano", "lightning",
    "fire", "water", "snow", "rain", "wind",
    "cactus", "palm tree", "rose", "mushroom", "leaf",
    "planet", "ocean", "desert", "island", "cave"
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
