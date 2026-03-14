# LingoLearn

An AI-powered language learning platform. Practice German, Spanish, and French through personalized lessons, spaced repetition, AI conversation, and classroom tools.

## What it does

- **AI lessons** — Exercises generated on the fly and tailored to your current CEFR level (A1–C2)
- **Spaced repetition** — Vocabulary and grammar reviews scheduled with the FSRS algorithm so you review right before you forget
- **AI conversation** — Chat with an AI persona in your target language; every message is graded and corrected in real time
- **Classroom tools** — Teachers can create classes, set assignments with due dates and pass thresholds, and run live quiz sessions with a live leaderboard
- **Progress tracking** — XP, daily streaks, streak freezes, and a per-language CEFR progress card
- **Flexible LLM backend** — Points to any OpenAI-compatible endpoint; each user can also plug in their own API key and model

## Deploy

### Docker Compose

The easiest way to run LingoLearn. Starts the app and a Postgres database together.

```bash
cp .env.example .env
# fill in AUTH_SECRET, LLM_BASE_URL, LLM_API_KEY, and optionally Google OAuth
docker compose up -d
```

```yaml
services:
  db:
    image: postgres:18
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: lingolearn
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql

  app:
    build: .
    restart: always
    ports:
      - '3000:3000'
    env_file:
      - .env
    depends_on:
      - db

volumes:
  pgdata:
```

The app will be available at `http://localhost:3000`.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js secret, minimum 32 characters |
| `LLM_BASE_URL` | Yes | Base URL of an OpenAI-compatible API (e.g. `https://api.openai.com/v1`) |
| `LLM_API_KEY` | Yes | API key for the LLM provider |
| `AUTH_GOOGLE_ID` | No | Google OAuth client ID — enables Sign in with Google |
| `AUTH_GOOGLE_SECRET` | No | Google OAuth client secret |

`LLM_BASE_URL` can point to OpenAI, Ollama, LM Studio, or any other OpenAI-compatible endpoint.

## License

MIT
