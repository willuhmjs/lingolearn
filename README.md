# Lernen Deutsch

A German language learning app with spaced repetition, AI-powered lesson generation, and grammar tracking. Built with SvelteKit, Prisma, and PostgreSQL.

## Features

- **Spaced Repetition (SRS)** — vocabulary and grammar rules are scheduled for review using an Elo-based rating system
- **AI Lesson Generation** — lessons are generated via any OpenAI-compatible LLM endpoint
- **CEFR Levels** — content scales from A1 to C2
- **Auth** — local credentials and Google OAuth via Auth.js
- **Admin Panel** — manage users and site settings

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Secret used to sign Auth.js session tokens |
| `AUTH_GOOGLE_ID` | No | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | No | Google OAuth client secret |
| `DEFAULT_LLM_BASE_URL` | No | Base URL for the OpenAI-compatible API (users can also set their own) |
| `DEFAULT_LLM_API_KEY` | No | API key for the default LLM endpoint |
| `DEFAULT_LLM_MODEL` | No | Model name (defaults to `gpt-3.5-turbo`) |

## Deployment

### Docker

The image is published to GitHub Container Registry on every push to `main` for `linux/amd64` and `linux/arm64`:

```
ghcr.io/willuhmjs/lernendeutsch:latest
```

Run with Docker Compose (includes PostgreSQL):

```sh
docker compose up -d
```

Or pull and run the image directly:

```sh
docker run -d \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/lernendeutsch" \
  -e AUTH_SECRET="your-secret" \
  ghcr.io/willuhmjs/lernendeutsch:latest
```
