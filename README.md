
# Zai — WhatsApp AI (Node.js, Firebase Functions)

Production-grade WhatsApp AI backend using **Node.js (TypeScript)** on **Firebase Functions (Node.js 20)**.
- Twilio WhatsApp inbound/outbound
- Gemini with RAG hooks
- Speech-to-Text & Text-to-Speech
- Firestore auth for Pro users
- Structured logging (pino), config validation, strong typing
- Local webhook emulator (Express) for curl/Postman testing
- CI-ready scripts (build, lint, test)

## Quickstart

```bash
cd functions
npm i
# Configure Twilio creds (for deployed functions)
firebase functions:config:set twilio.sid="ACxxxx" twilio.authtoken="your_token" twilio.auth_token="your_token"
# Optional local env (for emulator/local server)
cp .env.example .env
# Run local webhook server (Express, port 8787)
npm run dev:local
# OR Firebase emulator
npm run emu
```

### Deploy
```bash
npm run build
firebase deploy --only functions:zaiWebhook
```

### Firestore Data Model
`proUserMappings/{zporterUserId}`
```json
{
  "whatsappPhoneNumber": "+46701234567",
  "proSubscriptionStatus": "active",
}
```

