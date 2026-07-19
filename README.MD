# ⚡ Match Pulse

A real-time World Cup companion app, built for the **TxODDS × Superteam Earn
World Cup Hackathon**. Match Pulse turns TxLINE's live data feed into a
fan-first experience — live scores, live odds, and match events update in
real time, users can place predictions on match outcomes, and a linked
Telegram bot pushes instant alerts the moment something happens on the
pitch, all without needing the app open.

## Features

- **Live match tracking** — scores, corners, goals, and red cards update in
  real time, synced from TxLINE every 60 seconds.
- **Live odds & predictions** — home/draw/away odds per match, with in-app
  stake selection and bet placement.
- **Telegram alerts** — link your account to the Match Pulse bot to get
  pinged instantly for goals, red cards, big odds shifts, and full-time
  results, with live AI-generated commentary.
- **Solana wallet connect** — link a Solana wallet (e.g. Phantom) to your
  profile.
- **Profile & balance management** — add/withdraw balance, track total
  bets, wins, and win rate.
- **Automatic bet settlement** — pending bets settle automatically the
  moment a match completes.

## Tech Stack

- **Frontend:** HTML / CSS / vanilla JS, Firebase Auth + Firestore
- **Backend:** Node.js, Express, firebase-admin
- **Bot:** node-telegram-bot-api (polling)
- **Chain:** Solana (devnet) via `@coral-xyz/anchor` and `@solana/web3.js`
- **Data:** [TxLINE](https://txline.txodds.com) — live World Cup fixtures,
  odds, and scores
- **Hosting:** Railway

## Project Structure

```
.
├── index.html                # Frontend — full app UI, Firebase client SDK
├── server.js                 # Backend — TxLINE sync worker, Telegram bot, bet settlement
├── subscribeAndActivate.js   # One-time setup — devnet SOL airdrop, TxLINE subscription/activation
├── generateWallet.js         # One-time setup — generates a devnet Solana wallet
└── package.json
```

## How It Works

1. `server.js` polls TxLINE every 60 seconds for fixtures, odds, and scores,
   and writes them into Firestore's `markets` collection in the shape the
   frontend expects.
2. `index.html` listens to Firestore in real time (`onSnapshot`), so the UI
   updates the instant new data lands — no client-side polling.
3. Users place predictions, which are stored in Firestore's `bets`
   collection.
4. When a match completes, `server.js` automatically settles all pending
   bets on that match and credits winnings to user balances.
5. In parallel, `server.js` detects goals, cards, and significant odds
   shifts by comparing each sync against the previous state, and pushes a
   Telegram alert to linked users the moment something changes.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Generate a devnet wallet

```bash
npm run generate-wallet
```

Save the printed secret key — you'll need it for the next step.

### 3. Subscribe & activate your TxLINE API access

Set the `WALLET_SECRET_KEY` environment variable to the secret key array
from step 2, then run:

```bash
npm run subscribe-activate
```

This airdrops devnet SOL, subscribes on-chain to the free World Cup tier,
and prints your `TXLINE_GUEST_JWT` and `TXLINE_API_TOKEN` — save both.

### 4. Set environment variables

| Variable | Description |
|---|---|
| `TXLINE_GUEST_JWT` | From step 3 |
| `TXLINE_API_TOKEN` | From step 3 |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Full Firebase service account JSON, as a single-line string |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (from [@BotFather](https://t.me/BotFather)) |
| `IMGBB_API_KEY` | Free API key from [imgbb.com](https://api.imgbb.com/) — powers profile picture uploads |
| `GROQ_API_KEY` | Optional — enables AI-generated live commentary |
| `TELEGRAM_TTS_ENABLED` | Optional — set to `true` to enable voice alerts |
| `PORT` | Set automatically by Railway |

### 5. Run

```bash
npm start
```

This starts the server, the TxLINE sync loop, the Telegram bot, and serves
`index.html` at `/`.

## TxLINE Endpoints Used

- `POST /auth/guest/start` — guest JWT (auto-refreshed on 401)
- `GET /api/fixtures/snapshot` — full fixture list
- `GET /api/odds/snapshot/{fixtureId}` — live 1X2 odds per fixture
- `GET /api/scores/snapshot/{fixtureId}` — live score & match events
- `POST /api/token/activate` — one-time API token activation

## Telegram Bot Commands

| Command | Description |
|---|---|
| `/start` | Get started / see welcome message |
| `/link` | Link this chat to your Match Pulse account |
| `/unlink` | Stop receiving alerts on this chat |
| `/help` | Show all commands |

## License

Built for the TxODDS × Superteam Earn World Cup Hackathon.
