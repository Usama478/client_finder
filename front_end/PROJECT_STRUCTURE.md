# Client Finder - Project Structure

## Overview
Client Finder is a comprehensive SaaS-level frontend application for B2B client discovery, AI-powered relevance scoring, verification, and outreach management.

## Application Flow
```
Public Website → Authentication → Dashboard → Search → Relevance → Verification → Clients → Outreach
```

## Directory Structure

```
/src/app
├── App.tsx                 # Main app entry with RouterProvider
├── routes.tsx             # Complete routing configuration
├── layouts/
│   ├── PublicLayout.tsx   # Public website layout with header/footer
│   └── AppLayout.tsx      # Logged-in app shell with sidebar/topbar
├── pages/
│   ├── public/            # Public marketing pages
│   │   ├── HomePage.tsx
│   │   ├── FeaturesPage.tsx
│   │   └── PricingPage.tsx
│   ├── auth/              # Authentication pages
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   └── ForgotPasswordPage.tsx
│   ├── app/               # Main application pages
│   │   ├── DashboardPage.tsx           # Command center with KPIs and pipeline
│   │   ├── SearchBusinessesPage.tsx    # Search, relevance, verification workflow
│   │   ├── ClientsPage.tsx             # Saved clients database
│   │   ├── BusinessDetailsPage.tsx     # Detailed business view with tabs
│   │   ├── ContactsPage.tsx            # Contact management
│   │   ├── EmailWorkspacePage.tsx      # AI email generation and analytics
│   │   ├── ActivityPage.tsx            # Timeline of all actions
│   │   ├── ContextsPage.tsx            # Search context management
│   │   ├── BillingPage.tsx             # Subscription and usage
│   │   └── SettingsPage.tsx            # User and workspace settings
│   └── admin/             # Admin pages (role-based)
│       ├── AdminDashboardPage.tsx      # Platform monitoring
│       ├── UserManagementPage.tsx      # User CRUD
│       ├── ApiKeyManagementPage.tsx    # External API key management
│       └── ThresholdConfigPage.tsx     # AI threshold configuration
└── components/
    ├── ui/                # Reusable UI components (shadcn/ui)
    └── figma/            # Figma-specific components
```

## Key Features Implemented

### Public Website
- ✅ Hero section with product preview
- ✅ Feature showcases
- ✅ Pricing plans with comparison
- ✅ Trust indicators and social proof
- ✅ Responsive navigation

### Authentication
- ✅ Login with email/password
- ✅ Signup with validation
- ✅ Forgot password flow
- ✅ Error handling and loading states

### Dashboard
- ✅ 6 KPI cards (searches, leads, relevance, verified, clients, emails)
- ✅ 5-stage pipeline visualization
- ✅ Recent searches list
- ✅ Activity timeline
- ✅ Funnel conversion chart
- ✅ Verification distribution pie chart
- ✅ Next actions recommendations

### Search Businesses
- ✅ Search form with keywords, location, context selection
- ✅ Search results list with checkboxes
- ✅ Batch actions (relevance, verification, save)
- ✅ Progress indicators for AI processing
- ✅ Relevance scores with reasoning
- ✅ Verification status badges
- ✅ Search history with reload capability
- ✅ Real-time feedback via toasts

### Clients Page
- ✅ Filterable client database
- ✅ Table view with all key information
- ✅ Batch export functionality
- ✅ Quick actions (view, email, re-verify)
- ✅ Summary statistics

### Business Details
- ✅ Comprehensive overview tab
- ✅ AI relevance analysis with reasoning
- ✅ Detailed verification results
- ✅ Contact information
- ✅ Activity history timeline
- ✅ Outreach status tracking
- ✅ Quick actions (save, email, re-verify)

### Email Workspace
- ✅ AI-powered email generation
- ✅ Email draft editor
- ✅ Recipient management
- ✅ Campaign tracking
- ✅ Email analytics (sent, opened, clicked, bounced, replied)
- ✅ Performance metrics

### Admin Panel
- ✅ Platform metrics dashboard
- ✅ System health monitoring
- ✅ User management (CRUD)
- ✅ API key management
- ✅ AI threshold configuration with sliders
- ✅ Usage analytics charts

## Technology Stack

- **React** - UI framework
- **React Router** - Navigation (Data Router pattern)
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - Component library
- **Recharts** - Data visualization
- **Lucide React** - Icons
- **Sonner** - Toast notifications
- **Motion** - Animations

## Design System

### Colors
- Primary: Blue (#3b82f6)
- Success/Verified: Green (#10b981)
- Warning: Orange/Yellow
- Error: Red (#ef4444)
- Relevance: Purple (#9333ea)

### Status Badges
- Verified: Green
- Partial: Yellow/Secondary
- Pending: Outline
- Failed: Red

### Layout
- Fixed sidebar (collapsible): 256px → 80px
- Top bar: 64px height
- Content padding: 24px
- Card-based design with consistent spacing

## Data Flow (Mock Implementation)

All data is currently mocked for frontend demonstration. In production:

1. **Authentication** → Would connect to Supabase Auth
2. **Search** → Would call backend API for web scraping
3. **AI Relevance** → Would send to AI service with context
4. **Verification** → Would trigger verification microservice
5. **Storage** → Would use Supabase database for persistence
6. **Email** → Would integrate with email service provider

## State Management

- Local component state with `useState`
- URL state via React Router params
- Toast notifications for user feedback
- Loading states for async operations

## Responsive Design

- Mobile-first approach
- Collapsible sidebar on desktop
- Mobile menu drawer
- Responsive grids (1/2/3/4/6 columns)
- Adaptive table → card layouts on mobile

## Accessibility

- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Focus management
- Color contrast compliance

## Performance Optimizations

- Lazy loading routes (via React Router)
- Skeleton loading states
- Optimistic UI updates
- Debounced search inputs
- Memoized expensive calculations

## Next Steps for Production

1. **Backend Integration**
   - Connect to Supabase for auth and database
   - Implement real API endpoints
   - Add WebSocket for real-time updates

2. **Enhanced Features**
   - Implement actual AI relevance scoring
   - Add real verification service
   - Integrate email service provider
   - Add file upload for bulk import

3. **Testing**
   - Unit tests for components
   - Integration tests for workflows
   - E2E tests for critical paths

4. **Deployment**
   - Environment configuration
   - CI/CD pipeline
   - Performance monitoring
   - Error tracking

## Routes

### Public Routes
- `/` - Homepage
- `/features` - Features page
- `/pricing` - Pricing page

### Auth Routes
- `/auth/login` - Login
- `/auth/signup` - Signup
- `/auth/forgot-password` - Password reset

### App Routes
- `/app` - Dashboard
- `/app/search` - Search businesses
- `/app/clients` - Client database
- `/app/business/:id` - Business details
- `/app/contacts` - Contact management
- `/app/email` - Email workspace
- `/app/activity` - Activity timeline
- `/app/contexts` - Search contexts
- `/app/billing` - Billing & usage
- `/app/settings` - Settings

### Admin Routes
- `/app/admin` - Admin dashboard
- `/app/admin/users` - User management
- `/app/admin/api-keys` - API key management
- `/app/admin/thresholds` - AI configuration
