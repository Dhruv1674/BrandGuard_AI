# BrandGuard AI — Backend MVP

Node.js + Express + MongoDB Atlas + Gemini API backend for the CodeNexus India Round 2 MVP.

## Requirements
- Node.js 20+
- MongoDB Atlas cluster and database user
- Gemini API key from Google AI Studio

## Setup (Windows PowerShell)
1. Extract this folder into your project. The folder should be named `backend`.
2. Open a terminal in the `backend` folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env`:
   ```powershell
   Copy-Item .env.example .env
   ```
5. Edit `.env` and enter your MongoDB connection string and Gemini API key. Do not share `.env` or commit it to GitHub.
6. Start the server:
   ```powershell
   npm run dev
   ```
7. Open `http://localhost:5000/api/health`.

## API endpoints

### Create a brand
`POST /api/brands`

```json
{
  "name": "NovaTech",
  "description": "A consumer electronics company.",
  "toneOfVoice": "Professional, friendly and trustworthy.",
  "rules": [
    { "category": "Claims", "rule": "Do not promise guaranteed results without approved evidence.", "severity": "high" },
    { "category": "Tone", "rule": "Use professional and friendly language.", "severity": "medium" }
  ],
  "approvedFacts": [
    { "fact": "NovaTech sells consumer electronics.", "source": "Approved company profile" }
  ],
  "approvedTerms": ["NovaTech", "consumer electronics"],
  "prohibitedTerms": ["100% guaranteed results"]
}
```

### List brands
`GET /api/brands`

### Get one brand
`GET /api/brands/:id`

### Audit content
`POST /api/audits/check`

```json
{
  "brandId": "PASTE_BRAND_ID_HERE",
  "content": "NovaTech guarantees 100% results with every purchase!"
}
```

### List audits
`GET /api/audits` or `GET /api/audits?brandId=BRAND_ID`

### Get one audit
`GET /api/audits/:auditId`

### Approve or reject a finding
`PATCH /api/audits/:auditId/findings/:findingId/review`

```json
{ "decision": "approved" }
```

Use `rejected` to reject a finding.

## Important limitations before public deployment
This is an MVP starter for local development and judging demonstrations. It does not yet implement authentication, user/tenant authorization, rate limiting, CSRF protection, or workspace isolation. Do not expose it publicly with real customer data until these controls are added. API keys must remain on the server in `.env`. AI findings are suggestions and require human review; unsupported claims are not automatically false.
