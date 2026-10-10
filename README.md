# Meeting Action Item Tracker

> A production-style Forward Deployed Engineer portfolio application that parses unstructured business meeting transcripts into actionable commitments, strategic decisions, assignees, deadlines, and confidence scores with duplicate detection, human review controls, and enterprise audit logging.

---

## 1. Problem Statement

In enterprise organizations, critical decisions and commitments made during engineering standups, architecture reviews, and client escalation calls frequently become trapped in unstructured text transcripts or dispersed meeting notes. Manual synthesis is labor-intensive, error-prone, and slow:
* **Information Decay**: Action items lack explicit ownership or enforceable deadlines.
* **Duplication**: Repetitive commitments are created across siloed teams without cross-meeting deduplication.
* **Accountability Gaps**: Unassigned or ambiguous statements ("someone should look into this") pass through unnoticed without human triage.

---

## 2. Target Personas & Users

| Persona | Needs & Goals |
| :--- | :--- |
| **Business User (Engineering Manager / PM)** | Needs immediate structured visibility into who owns what and target dates without reading 45-minute transcripts. |
| **Operations / Team Lead** | Needs cross-meeting deliverable tracking, duplicate detection, and automated export into task management systems. |
| **Security & Compliance Stakeholder** | Requires tamper-evident audit trails, SOC 2 compliance logging, and zero exposure of API credentials to browser clients. |

---

## 3. Business Value & ROI

By automating transcript extraction while maintaining strict human-in-the-loop review controls:
* **Time Savings**: Reduces manual meeting follow-up synthesis from ~10 minutes per meeting to under 2 minutes of verification.
* **Follow-Through Precision**: Flags low-confidence extractions (<70%) and missing assignees before tasks are committed.
* **Standardization**: Enforces structured JSON schemas and normalized relative dates (e.g. converting "next Friday" to `YYYY-MM-DD`).

---

## 4. Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (React / Vite / Tailwind CSS)"]
        UI[Enterprise Dashboard & Review UI]
        Forms[New Meeting & Transcript Intake]
        Filters[Action Items & Directory Filter]
    end

    subgraph Backend ["Full-Stack API Layer (Express / Node.js)"]
        Router["/api/meetings, /api/action-items, /api/metrics"]
        Zod[Zod Runtime Input Validation]
        Audit[Audit Logging Engine]
        Dedup[Duplicate Detection Engine]
    end

    subgraph AI ["AI Extraction Service (Server-Side)"]
        Service["MeetingExtractorService (gemini-3.8-flash)"]
        PromptEngine["System Instruction & Strict JSON Schema"]
        DateNorm["Relative Date Normalizer"]
    end

    subgraph Data ["Data & Persistence Layer"]
        DB[(PostgreSQL Architecture / Prisma ORM)]
        Files[Export Engine: CSV / JSON]
    end

    Forms -->|POST /api/meetings| Router
    Router -->|Validate| Zod
    Router -->|POST /api/meetings/:id/extract| Service
    Service -->|generateContent with Schema| PromptEngine
    PromptEngine --> DateNorm
    DateNorm --> Dedup
    Dedup --> DB
    Router -->|Log Event| Audit
    DB --> UI
    DB --> Files
```

---

## 5. Core Features

1. **AI Extraction Pipeline**: Leverages Google Gemini 3.8 Flash via the modern `@google/genai` TypeScript SDK with strict JSON schema constraints.
2. **Confidence Scoring & Review Flagging**:
   * Confidence ≥ 85%: High-confidence automated commitment.
   * Confidence < 70%: Highlighted as **Needs Review**.
   * Missing owner or missing deadline triggers **Owner Missing** or **Due Date Missing** alerts.
3. **Duplicate Detection Engine**: Computes token overlap and Jaccard similarity across past deliverables to flag potential duplicates without destructive deletion.
4. **Interactive Review Workspace**:
   * Side-by-side inspection of decisions and tasks.
   * Verbatim transcript citation ("evidence") for every item.
   * Single-click Approve, Reject, Complete, Edit Modal, or Bulk Approve.
5. **Universal Action Items Directory**: Filterable by status (`pending`, `approved`, `completed`, `overdue`, `needs-review`) with keyword search.
6. **Configurable ROI Model**: Live slider and numeric configuration to calculate engineering minutes saved per meeting.
7. **Compliance Audit Trail**: Event logging with state diff snapshots for meeting creations, AI extractions, edits, and status transitions.
8. **Export Facilities**: Native downloadable CSV and JSON exports.
9. **Instant Demo Benchmark Presets**: Three pre-configured enterprise transcripts ready for 1-click evaluation.

---

## 6. Setup & Installation

### Prerequisites
* Node.js 18+ or 20+
* npm or pnpm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your GEMINI_API_KEY if testing live cloud model inference

# 3. Run development server (runs full-stack Express + Vite on port 3000)
npm run dev

# 4. Run automated test suite
npm test

# 5. Build for production
npm run build
npm start
```

---

## 7. Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key for server-side inference | Injected automatically in AI Studio |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/meeting_tracker` |
| `APP_URL` | Application hosting URL | `http://localhost:3000` |
| `MANUAL_MINUTES_PER_MEETING` | Baseline manual synthesis time | `10` |
| `AUTOMATED_MINUTES_PER_MEETING` | Baseline automated review time | `2` |

---

## 8. Backend API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/meetings` | Create a new meeting (validated with Zod). |
| `GET` | `/api/meetings` | List all meetings with deliverable summary counts. |
| `GET` | `/api/meetings/:id` | Get meeting details, decisions, action items, and audit log. |
| `POST` | `/api/meetings/:id/extract` | Trigger server-side Gemini AI extraction. |
| `DELETE` | `/api/meetings/:id` | Delete meeting and cascade deliverables. |
| `GET` | `/api/action-items` | Query action items with filters (`status`, `needsReview`, `search`). |
| `PATCH` | `/api/action-items/:id` | Update action description, owner, due date, or status. |
| `DELETE` | `/api/action-items/:id` | Delete action item and log audit event. |
| `POST` | `/api/action-items/:id/complete` | Mark action item as completed. |
| `POST` | `/api/action-items/:id/approve` | Approve action item and clear review flag. |
| `POST` | `/api/action-items/bulk-approve` | Bulk approve all pending items in a meeting. |
| `GET` | `/api/metrics` | Retrieve dashboard KPIs, confidence distribution, and time saved. |
| `GET` | `/api/export/csv` | Download CSV of action items. |
| `GET` | `/api/export/json` | Download JSON payload of full meeting dataset. |
| `GET` | `/api/audit-logs` | Retrieve chronological security audit trail. |
| `PATCH` | `/api/settings` | Update time savings assumptions and confidence threshold. |
| `POST` | `/api/seed` | Reset and reseed 5 synthetic enterprise meetings. |

---

## 9. Automated Testing

Run the test suite with:

```bash
npm test
```

The test runner validates:
1. **Validation**: Valid meeting payloads pass Zod schemas.
2. **Validation**: Rejection of empty titles, invalid transcripts, and malformed dates.
3. **AI Response Schema**: Strict structural validation of decision and action item arrays.
4. **Missing Information**: Ensures missing owners and deadlines are mapped to `null` and flagged for review.
5. **Low Confidence**: Ambiguous statements produce confidence < 0.70 with review flags.
6. **Duplicate Detection**: Accurately computes high similarity on overlapping action descriptions.
7. **Database CRUD**: Creation, cascade deletion, updates, and audit logging.
8. **Deliverable Lifecycle**: Item approval, rejection, and completion workflows.
9. **Metrics Engine**: Verifies dynamic recalculation of hours saved based on user-configured baselines.

---

## 10. Security & Compliance Architecture

* **Zero Client-Side Keys**: The Gemini API key is strictly maintained in server environment memory (`process.env.GEMINI_API_KEY`) and never sent to browser clients.
* **User-Agent Telemetry**: Configured with `httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }`.
* **Input Sanitization**: Request bodies validated using Zod with payload size limits (10MB body parser).
* **Correlation IDs**: Every API request generates and propagates an `X-Correlation-Id` header for end-to-end observability.
* **Audit Logging**: All write and review mutations are recorded in the `audit_logs` table with previous and new value snapshots.

---

## 11. Production Readiness & Enterprise Roadmap

For enterprise-scale production rollout:
* **Relational Database**: Connect PostgreSQL via the included `prisma/schema.prisma` or `schema.sql` migration scripts with pgvector for embedding-based semantic duplicate search.
* **External Task Sync**: Bi-directional webhooks with Linear, Jira, and Asana for automated ticket synchronization upon item approval.
* **Authentication & RBAC**: Integration with Okta / Google Workspace SSO enforcing role-based permissions (Viewer, Reviewer, Admin).
* **Audio Ingestion**: Direct integration with Gemini 3.5 Transcribe to accept `.mp3`/`.wav` recordings alongside raw text notes.
