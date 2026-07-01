# AI Procurement Agent

WhatsApp-based AI agent for automated supplier communication, document analysis, and procurement reporting.

## Project Overview

Automates the entire procurement workflow:
1. Receives messages and documents from suppliers via WhatsApp
2. Parses PDF / Word / Excel / photo attachments
3. Extracts structured data (prices, terms, delivery dates)
4. Maintains per-supplier conversation history
5. Generates comparison reports (Word / Excel / PDF)

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (TypeScript) |
| WhatsApp | whatsapp-web.js |
| AI | open-ai chatgpt |
| Database | supabase |
| Job Queue | BullMQ (Redis) |
| PDF parsing | pdf-parse |
| Word parsing | mammoth |
| Excel parsing | xlsx |
| OCR (photos) | tesseract.js |
| Report: Word | docx |
| Report: Excel | exceljs |
| Report: PDF | pdfkit |
| Deployment | Docker + VPS |

## Repository Structure

```
src/
  whatsapp/          # whatsapp-web.js client, session management
  agent/             # OpenAI API integration, prompt management
  parsers/           # Document parsers (pdf, docx, xlsx, image)
  db/                # Supabase client, query helpers
  queue/             # BullMQ job definitions and processors
  reports/           # Word / Excel / PDF report generators
  comparison/        # Offer normalization and comparison logic
  config/            # Environment config, constants
supabase/
  migrations/
docker-compose.yml
.env.example
```

## Database Schema (Supabase)

Core entities:

```
Supplier        — id, name, phone, language, createdAt
  └── Message   — id, supplierId, direction (IN/OUT), body, timestamp
  └── Document  — id, supplierId, messageId, type, filePath, parsedJson
  └── Offer     — id, supplierId, items[], totalPrice, deliveryDays, terms, receivedAt
```

## Environment Variables

```env
# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o

# Supabase
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Redis (BullMQ)
REDIS_URL=redis://localhost:6379

# WhatsApp session path
WA_SESSION_PATH=./sessions

# Report output directory
REPORT_OUTPUT_DIR=./reports
```

## Development Phases

### Phase 1 — WhatsApp Integration
- [ ] QR-based session auth with session persistence
- [ ] Incoming message handler (text + attachments)
- [ ] Attachment downloader (PDF, docx, xlsx, jpg/png)
- [ ] Outgoing message sender
- [ ] Multi-supplier parallel handling via BullMQ

### Phase 2 — Document Parsing
- [ ] PDF parser → raw text
- [ ] Word (.docx) parser → raw text
- [ ] Excel (.xlsx) parser → row arrays
- [ ] Image OCR (tesseract.js) → raw text
- [ ] Store parsed output as JSON in `Document` table

### Phase 3 — AI Agent Core
- [ ] OpenAI API wrapper with retry + rate limiting
- [ ] System prompt: procurement analyst persona
- [ ] Conversation context builder (last N messages per supplier)
- [ ] Structured extraction: price list, delivery, payment terms
- [ ] Auto-reply: ask supplier for missing fields
- [ ] Language detection (ru / kz / en) → respond in same language

### Phase 4 — Supplier Memory
- [ ] Supabase CRUD repository for all entities
- [ ] Conversation history per supplier (paginated)
- [ ] Document version tracking (supplier sends updated offer)
- [ ] Offer deduplication

### Phase 5 — Report Generation
- [ ] Excel: comparison table (suppliers × items, price, delivery, terms)
- [ ] Word: narrative summary with best-offer recommendation
- [ ] PDF: executive version for management

### Phase 6 — Offer Comparison
- [ ] Normalize offers to common unit (per kg / per unit / per m²)
- [ ] Multi-criteria scoring: price weight 60%, delivery 25%, terms 15%
- [ ] Flag missing data fields per supplier
- [ ] Best-offer recommendation with justification

## OpenAI API Usage

Default model: `gpt-4o`. Use `gpt-4o-mini` only for low-stakes classification tasks to save cost.

Prompt structure:
- **System**: procurement analyst role, output format instructions, language rules
- **User**: supplier message + parsed document content + conversation history
- **Expected output**: JSON with extracted fields + reply text

Always request structured output via `response_format: { type: "json_object" }` so parsing is deterministic.

Keep extracted fields schema consistent across all suppliers so the comparison engine can normalize them without custom logic.

## Key Constraints

- whatsapp-web.js requires a persistent Chromium session — do not run in serverless environments
- WhatsApp ToS prohibits bulk messaging; this agent only responds to inbound messages from known suppliers
- OCR accuracy on low-quality photos may be poor — flag low-confidence extractions in the DB rather than silently dropping them
- OpenAI API has rate limits — all AI calls go through BullMQ with concurrency ≤ 5

## Running Locally

```bash
# Start dependencies (Redis only — Supabase runs in the cloud)
docker-compose up -d redis

# Install dependencies
npm install

# Apply Supabase migrations (requires Supabase CLI)
supabase db push

# Start agent (scan QR in terminal)
npm run dev
```

## Testing

```bash
npm test                  # unit tests
npm run test:integration  # requires Supabase + Redis running
```

Use real document fixtures in `tests/fixtures/` — do not mock the parser libraries, as format edge cases matter.
