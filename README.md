# Majorly Lost

A Miami Dade College student signs in, picks one of five careers, and rides a semester-by-semester map drawn from the official course sequence. Swarms writes the ticket: why this ride, certificates, and three resume bullets. Gemini is the Conductor, a chat that stays inside that sequence.

## Run

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` for Auth0, Swarms, and Gemini. Without Auth0, the landing page works and `/dashboard` returns 503. Without a Swarms key, the ticket uses the saved fixture. Without a Gemini key, the Conductor uses a saved reply. The stations still come from the course sequence.

```bash
npm test
```
