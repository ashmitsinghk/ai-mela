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
    "octopus", "spider", "rabbit", "dragon", "unicorn",
    "dolphin", "eagle", "owl", "fox", "wolf",
    "horse", "cow", "pig", "sheep", "duck",
    "chicken", "rooster", "mouse", "rat", "hamster",
    "parrot", "peacock", "flamingo", "swan", "crab",
    "lobster", "jellyfish", "starfish", "seahorse", "seal",
    "walrus", "polar bear", "koala", "sloth", "hedgehog",
    "bat", "bee", "ant", "ladybug", "scorpion",
    "camel", "llama", "hippo", "rhino", "cheetah", "leopard"
  ],
  objects: [
    "house", "car", "tree", "sun", "moon",
    "umbrella", "key", "book", "clock", "guitar",
    "pencil", "chair", "table", "computer", "phone",
    "camera", "shoes", "hat", "glasses", "backpack",
    "bicycle", "train", "plane", "boat", "rocket",
    "bed", "lamp", "door", "window", "knife",
    "fork", "spoon", "plate", "cup", "bottle",
    "box", "bag", "ball", "doll", "kite",
    "balloon", "candle", "match", "scissors", "hammer",
    "saw", "nail", "screw", "broom", "mop",
    "bucket", "towel", "soap", "toothbrush", "comb",
    "brush", "mirror", "headphones", "microphone", "television",
    "radio", "remote", "battery", "flashlight", "watch"
  ],
  food: [
    "pizza", "apple", "banana", "cake", "ice cream",
    "hamburger", "coffee", "carrot", "watermelon", "cheese",
    "bread", "cookie", "donut", "grape", "lemon",
    "orange", "strawberry", "tomato", "potato", "popcorn",
    "sushi", "sandwich", "taco", "chocolate", "egg",
    "salad", "soup", "steak", "chicken", "rice",
    "pasta", "noodle", "corn", "broccoli", "onion",
    "garlic", "pepper", "chillies", "cucumber", "avocado",
    "pineapple", "mango", "peach", "pear", "plum",
    "cherry", "berries", "kiwi", "melon", "coconut",
    "milk", "juice", "tea", "soda", "water",
    "butter", "yogurt", "honey", "jam", "peanut butter",
    "candy", "gum", "lollipop", "marshmallow", "chips"
  ],
  nature: [
    "mountain", "flower", "cloud", "star", "rainbow",
    "beach", "forest", "river", "volcano", "lightning",
    "fire", "water", "snow", "rain", "wind",
    "cactus", "palm tree", "rose", "mushroom", "leaf",
    "planet", "ocean", "desert", "island", "cave",
    "sunflower", "tulip", "daisy", "grass", "dirt",
    "rock", "stone", "sand", "mud", "hill",
    "valley", "canyon", "cliff", "waterfall", "lake",
    "pond", "sea", "wave", "storm", "thunder",
    "tornado", "hurricane", "earthquake", "flood", "ice",
    "frost", "mist", "fog", "smoke", "dust",
    "bubble", "diamond", "gold", "silver", "bronze",
    "metal", "wood", "glass", "plastic", "paper"
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
