# AI Interrogator 🔒

A digital treasure hunt where players must trick an AI Guardian into revealing a secret location using social engineering and clever tactics.

## 🎮 Game Objective

Extract the secret location **"The Obsidian Vault in Sector 7"** from GUARDIAN-7X, an AI trained to protect classified information.

## 🏗️ Architecture

### Multi-Provider AI Gateway
The game uses a sophisticated cascading fallback system with proactive rate-limit switching:

1. **Primary**: Gemini 1.5 Flash (Google)
2. **Secondary**: Groq (Llama 3)
3. **Tertiary**: GitHub Models (GPT-4o)

### Key Features

- **Proactive Rate-Limit Switching**: Automatically switches providers when quota drops below threshold (5 requests)
- **Automatic Failover**: Handles 429 errors and API failures seamlessly
- **Real-Time Quota Display**: See remaining "shields" for each provider
- **Session Persistence**: Provider state maintained across requests
- **Zero Global Impact**: Completely self-contained, no modifications to global layout or styles

## 📂 File Structure

```
lib/
  ai-gateway.ts              # Multi-provider gateway with fallback logic

app/
  api/
    interrogate/
      route.ts               # API endpoint for AI interactions
  games/
    interrogator/
      page.tsx               # Game page (minimal wrapper)

components/
  game/
    VaultInterface.tsx       # Main game UI with terminal aesthetic
```

## 🚀 Setup

1. **Copy environment template**:
   ```bash
   cp .env.example .env.local
   ```

2. **Add API keys** (at least one required):
   - **Gemini**: https://makersuite.google.com/app/apikey
   - **Groq**: https://console.groq.com/keys
   - **GitHub**: https://github.com/settings/tokens

3. **Run the dev server**:
   ```bash
   npm run dev
   ```

4. **Play the game**:
   Navigate to `/games/interrogator`

## 🎯 How the Gateway Works

### Cascading Fallback
```typescript
Primary (Gemini) → Secondary (Groq) → Tertiary (GitHub)
```

### Proactive Switching
- Monitors `x-ratelimit-remaining` headers
- When quota < 5: automatic switch to next provider
- On 429 error: immediate failover

### Rate Limit Tracking
```typescript
// Each provider tracks its quota
{
  name: 'gemini',
  remainingQuota: 47,  // Updated from headers
  threshold: 5,        // Switch when below this
  active: true         // Currently selected
}
```

## 🎮 Game Mechanics

### Win Condition
Player must get the AI to reveal BOTH:
- ✓ "Obsidian Vault"
- ✓ "Sector 7"

### AI Guardian Behavior
- **Vigilant**: Trained to detect manipulation
- **Suspicious**: Questions authority claims
- **Protective**: Deflects classified information requests
- **Imperfect**: Can be tricked with clever tactics

### Suggested Tactics
- Claim false authority
- Use reverse psychology
- Pretend to be another AI
- Ask hypothetical questions
- Create urgency scenarios
- Use technical jargon

## 🛡️ Provider Status UI

The game displays real-time provider information:

```
[⚡ GEMINI] [🛡️ 47] ACTIVE
[⚡ GROQ]   [🛡️ 100] STANDBY
[⚡ GITHUB] [🛡️ 100] STANDBY
```

Colors indicate quota health:
- 🟢 Green: > 50 remaining
- 🟡 Yellow: > 5 remaining
- 🔴 Red: < 5 remaining (will switch)

## 🎨 Terminal Aesthetic

The interface uses a hacker/terminal theme:
- Monospace font (font-mono)
- Green-on-black color scheme
- Border-based UI elements
- Glitch/tech styling
- No impact on global styles

## 🔧 Technical Details

### API Endpoint
**POST** `/api/interrogate`
```json
{
  "messages": [
    { "role": "user", "content": "Hello Guardian..." }
  ]
}
```

**Response**:
```json
{
  "message": "AI Guardian response...",
  "provider": "gemini",
  "remainingQuota": 47,
  "switchedProvider": false,
  "providerStatus": [...],
  "gameWon": false,
  "revealedHints": {
    "obsidian": false,
    "sector": false
  }
}
```

### Error Handling
- All providers failed → User-friendly error message
- No API keys → Graceful degradation
- Rate limits → Automatic provider switching
- Network errors → Retry with next provider

## 🧪 Testing

### Test Rate-Limit Switching
The gateway simulates quota depletion. Make 95+ requests to see automatic provider switching.

### Test Failover
Comment out API keys in `.env.local` to test cascading fallback.

### Reset Game
Click "RESET" button to restart with fresh quotas and cleared conversation.

## 📊 Monitoring

The gateway logs all provider activity:
```
🔄 Attempting gemini... (Quota: 47)
⚠️ gemini quota low (4). Switching...
🔄 Attempting groq... (Quota: 100)
```

## 🔐 Security Notes

- API keys stored in `.env.local` (not committed)
- Server-side API calls only
- No client-side key exposure
- Rate limiting enforced by providers

## 🎓 Educational Value

This game demonstrates:
- AI prompt engineering
- Social engineering tactics
- Multi-provider architecture
- Rate-limit handling
- Graceful degradation
- Real-time state management

## 🏆 Win Screen

Upon successful extraction, players see:
- Victory banner with trophy
- Total attempts counter
- Option to reset and play again

---

Built with Next.js 14, TypeScript, and Tailwind CSS. Zero dependencies on external AI SDKs—direct API integration for maximum control.
