# CLIENT FINDER — PROJECT MAP
# Drop this file in .cursor/project-map.md
# The agent reads this instead of exploring the repo.
# Update the "Key files" section whenever you add a major page or agent.

## Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives) |
| Icons | lucide-react |
| Forms | react-hook-form |
| Charts | recharts |
| Toasts | sonner |
| Routing | react-router 7 |
| Backend | FastAPI (Python) |
| AI Agents | LangGraph |
| Package mgr | pnpm |

## Frontend — Folder Map
```
front_end/src/
├── app/
│   ├── App.tsx                         # Root, router setup
│   ├── routes.tsx                      # All route definitions
│   ├── components/
│   │   ├── ui/                         # shadcn components (DO NOT edit these)
│   │   ├── EmptyState.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ProtectedRoute.tsx
│   ├── layouts/
│   │   ├── AppLayout.tsx               # Authenticated shell (sidebar, nav)
│   │   └── PublicLayout.tsx            # Marketing shell
│   └── pages/
│       ├── app/
│       │   ├── SearchBusinessesPage.tsx  ← LARGE FILE (~1200 lines) use ast-grep
│       │   ├── BusinessDetailsPage.tsx
│       │   ├── ClientsPage.tsx
│       │   ├── ContactsPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── EmailWorkspacePage.tsx
│       │   ├── ActivityPage.tsx
│       │   ├── BillingPage.tsx
│       │   ├── ContextsPage.tsx
│       │   └── SettingsPage.tsx
│       ├── admin/
│       │   ├── AdminDashboardPage.tsx
│       │   ├── ApiKeyManagementPage.tsx
│       │   ├── ThresholdConfigPage.tsx
│       │   └── UserManagementPage.tsx
│       ├── auth/
│       │   ├── LoginPage.tsx
│       │   ├── SignupPage.tsx
│       │   ├── ForgotPasswordPage.tsx
│       │   ├── ResetPasswordPage.tsx
│       │   └── VerifyEmailPage.tsx
│       └── public/
│           ├── HomePage.tsx
│           ├── FeaturesPage.tsx
│           └── PricingPage.tsx
└── lib/
    └── api.ts                          # All API calls live here
```

## Backend — Folder Map
```
backend/app/
├── agents/
│   ├── relevancy/
│   │   ├── graph.py       # LangGraph graph definition
│   │   ├── nodes.py       # Graph nodes
│   │   ├── state.py       # AgentState schema
│   │   ├── schemas.py     # Pydantic I/O models
│   │   ├── prompts.py     # LLM prompts
│   │   ├── service_v2.py  # Entry point called by API routes
│   │   └── tools_v2/      # Tool implementations
│   ├── verification/
│   │   ├── graph.py
│   │   ├── runner.py
│   │   ├── service.py     # Entry point
│   │   ├── llm_analyst.py
│   │   ├── llm_router.py
│   │   └── tools/ + tools_v2/
│   └── email_outreach/
│       ├── graph.py
│       ├── state.py
│       ├── runner.py
│       ├── draft_generator.py
│       ├── email_draft_service.py
│       ├── followup_scheduler.py
│       ├── llm_router.py
│       ├── pre_checks.py
│       ├── sendgrid_service.py
│       └── tools/
└── core/
    └── security.py
```

## Key Interfaces (SearchBusinessesPage.tsx)
These are the main data shapes in the large page file.
Use this to avoid reading the file just to check field names.

```typescript
// BusinessResult — raw API response shape
interface BusinessResult {
  result_id: number;
  business_name: string;
  business_type: string;
  address: string;
  website: string;
  source: "maps" | "serp" | null;
  email_found: string | null;
  all_phones_found: string[];
  relevance_decision: "relevant" | "irrelevant" | "unknown" | "skipped" | "error" | null;
  relevance_score: number | null;
  relevance_reason: string;
  verification_status: string | null;
  verification_result: string | null;
  verification_score: number | null;
  verification_reason: string;
}

// tableData row shape (mapped from BusinessResult)
// Fields: id, name, category, location, website, source,
//         email, phone, relevanceScore, relevanceStatus,
//         verificationScore, verificationStatus,
//         reasoning, verificationReasoning
```

## API Conventions
- All API calls go through `src/lib/api.ts` — do not use fetch() directly in pages
- Auth token is attached automatically inside api.ts
- Backend base URL is set via Vite env variable `VITE_API_URL`

## Naming Conventions
| Thing | Convention |
|-------|-----------|
| React components | PascalCase |
| Hooks | camelCase, prefix `use` |
| API functions | camelCase verbs (`searchBusinesses`, `getClient`) |
| Python files | snake_case |
| LangGraph nodes | snake_case functions in nodes.py |
| Pydantic models | PascalCase |

## Large Files — Always Use ast-grep
These files are > 400 lines. Never read them in full.
Always use ast-grep to get line ranges first.

| File | Why it's large |
|------|---------------|
| SearchBusinessesPage.tsx | Full search UI, table, filters, polling, modals |
| BusinessDetailsPage.tsx  | Detail view with tabs |
| EmailWorkspacePage.tsx   | Email compose + thread UI |
| verification/service.py  | LangGraph orchestration |
| relevancy/service_v2.py  | Relevancy pipeline |