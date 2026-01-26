# AI Scribble Challenge (Reverse Pictionary)

A real-time drawing guessing game where you race against AI to draw an object before it can identify what you're creating.

## 🎮 Game Mechanics

- **Objective**: Draw the target word before the AI guesses it
- **Time Limit**: 30 seconds per round
- **AI Model**: Llama 4 Scout (17B-16E) via Groq
- **Analysis**: Real-time polling every 1 second

## 🏗️ Architecture

### Components
- **ScribbleChallenge.tsx** - Main game component with canvas and game logic
- **words-list.ts** - Curated drawable words across 4 categories
- **scribble.ts** - Server action for AI vision analysis

### Key Features

#### 1. Optimized Canvas
- 512x512 resolution for token efficiency
- JPEG compression (0.5 quality) to stay under Groq's 4MB limit
- Touch and mouse support for drawing
- Hand-drawn aesthetic with stone color palette

#### 2. Proactive Rate Limit Management
- Monitors `x-ratelimit-remaining-tokens` and `x-ratelimit-remaining-requests`
- Activates "shield mode" when quota falls below threshold
- Pauses polling for 5 seconds during shield activation
- Displays user-friendly "Guardian recharging" message

#### 3. Real-time Analysis
- 1-second polling interval during gameplay
- Normalized string matching for win detection
- Confidence scoring based on response quality
- Error handling for API failures

## 📁 File Structure

```
components/game/scribble/
├── ScribbleChallenge.tsx    # Main game component
└── words-list.ts            # Word categories and random selection

app/
├── actions/
│   └── scribble.ts          # Server action with Groq integration
└── games/scribble/
    └── page.tsx             # Game page route
```

## 🚀 Usage

Navigate to `/games/scribble` to play the game.

### Environment Variables Required
```bash
GROQ_API_KEY=your_groq_api_key_here
```

## 🎨 Design Philosophy

- **Digital Notebook Aesthetic**: Stone-50 background with stone-300 borders
- **No Global Modifications**: All styling is scoped to the component
- **Self-contained**: Fully isolated in the scribble folder
- **Responsive**: Works on desktop and mobile devices

## 🔧 Technical Details

### Canvas Export Function
```typescript
exportToBlob(): Promise<string>
```
- Downscales to 512x512
- Converts to JPEG with 0.5 quality
- Returns base64 data URL
- Optimized for Groq's token limits

### Rate Limit Thresholds
- Tokens: < 10,000 remaining triggers shield
- Requests: < 10 remaining triggers shield
- Shield duration: 5 seconds

### Win Condition
```typescript
normalizedGuess === normalizedTarget
```
Compares lowercase, trimmed strings for accuracy.

## 🎯 Word Categories

- **Animals**: cat, dog, elephant, giraffe, etc.
- **Objects**: house, car, tree, sun, etc.
- **Food**: pizza, apple, banana, cake, etc.
- **Nature**: mountain, flower, cloud, star, etc.

Total: 40 unique words across 4 categories
