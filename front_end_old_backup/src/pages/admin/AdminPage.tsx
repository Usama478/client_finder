import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Database,
  Gauge,
  Layers3,
  LifeBuoy,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { EmptyState } from "../../components/page/EmptyState";
import { ErrorState } from "../../components/page/ErrorState";
import { LoadingState } from "../../components/page/LoadingState";
import { PageHeader } from "../../components/page/PageHeader";
import { StatusNotice } from "../../components/page/StatusNotice";
import { StatCard } from "../../components/StatCard";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import {
  fetchApiHealth,
  fetchContexts,
  fetchDashboardStats,
  fetchHistory,
  fetchSavedClients,
} from "../../services/api";
import type { SearchContext } from "../../types/search-context";
import type { SearchResult } from "../../types/search-result";
import type { SearchSession } from "../../types/search-session";
import { getSearchSessionQuery } from "../../types/search-session";

interface DashboardStats {
  total_clients: number;
  verified_clients: number;
  unverified_clients: number;
  total_searches: number;
}

interface HealthResponse {
  status?: string;
}

interface AdminThresholds {
  verificationMinimum: string;
  reviewThreshold: string;
  exportWindow: string;
  automationMode: string;
}

const defaultThresholds: AdminThresholds = {
  verificationMinimum: "70",
  reviewThreshold: "45",
  exportWindow: "30",
  automationMode: "manual-review",
};

export function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [contexts, setContexts] = useState<SearchContext[]>([]);
  const [history, setHistory] = useState<SearchSession[]>([]);
  const [clients, setClients] = useState<SearchResult[]>([]);
  const [thresholds, setThresholds] = useState<AdminThresholds>(defaultThresholds);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [savedMessageVisible, setSavedMessageVisible] = useState(false);

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        setIsLoading(true);
        setPageError(null);
        const [statsData, healthData, contextData, historyData, clientData] =
          await Promise.all([
            fetchDashboardStats(),
            fetchApiHealth(),
            fetchContexts(),
            fetchHistory(),
            fetchSavedClients(),
          ]);

        setStats(statsData);
        setHealth(healthData);
        setContexts(Array.isArray(contextData) ? contextData : []);
        setHistory(Array.isArray(historyData) ? historyData : historyData.history || []);
        setClients(Array.isArray(clientData) ? clientData : []);
      } catch (error) {
        console.error("Failed to load admin data:", error);
        setPageError("Unable to load admin workspace data right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadAdminData();
  }, []);

  const recentSearches = useMemo(() => history.slice(0, 5), [history]);
  const averageVerificationScore = useMemo(() => {
    const scoredClients = clients.filter(
      (client) => typeof client.verification_score === "number",
    );
    if (scoredClients.length === 0) {
      return 0;
    }

    const total = scoredClients.reduce(
      (sum, client) => sum + (client.verification_score || 0),
      0,
    );
    return Math.round(total / scoredClients.length);
  }, [clients]);

  const healthBadges = [
    {
      label: "Core API",
      status: health?.status ? "Live" : "Unknown",
      tone: health?.status ? "success" : "warning",
      detail: health?.status || "Health endpoint unavailable",
    },
    {
      label: "Auth service",
      status: "Deferred",
      tone: "warning",
      detail: "Frontend routes exist; backend auth wiring is still pending.",
    },
    {
      label: "Billing service",
      status: "Deferred",
      tone: "warning",
      detail: "Billing UI is in place, payment processing is not connected.",
    },
    {
      label: "Email dispatch",
      status: "Deferred",
      tone: "warning",
      detail: "Outreach workflows are staged, but real sending is not enabled.",
    },
  ] as const;

  const moduleStatuses = [
    { name: "Guided workflow", state: "Live", detail: "Search through business details is fully navigable." },
    { name: "Contexts", state: "Live", detail: "List and create flows reuse the current API." },
    { name: "Settings", state: "Partial", detail: "UI-complete with local persistence, awaiting backend settings storage." },
    { name: "Auth", state: "Partial", detail: "Frontend-ready routes with explicit backend-safe stubs." },
    { name: "Billing", state: "Deferred", detail: "Plan and usage shell only." },
    { name: "Outreach", state: "Partial", detail: "Queue and analytics surface exists; sending/tracking is deferred." },
  ];

  if (isLoading) {
    return <LoadingState message="Loading admin workspace..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load Admin"
          message={pageError}
          action={(
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-8">
      <PageHeader
        title="Admin"
        description="A lightweight operational console for the staged SaaS surface: enough to monitor what is live today without pretending backend administration is finished."
        actions={(
          <Button variant="outline" asChild>
            <Link to="/activity">Open activity</Link>
          </Button>
        )}
      />

      <StatusNotice
        className="mb-8"
        title="Admin is mixed by design"
        description="Stats, contexts, recent searches, and API health use existing data. User management, automation thresholds, and system controls are intentionally represented as safe placeholders."
      />

      <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Workspace operators"
          value="1"
          subtitle="Placeholder until team management backend exists"
          icon={<Users className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Saved clients"
          value={String(stats?.total_clients || 0)}
          subtitle={`${stats?.verified_clients || 0} verified`}
          icon={<ShieldCheck className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Search sessions"
          value={String(stats?.total_searches || history.length)}
          subtitle={`${contexts.length} contexts available`}
          icon={<Layers3 className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="API health"
          value={health?.status ? "Healthy" : "Unknown"}
          subtitle="Live ping against current backend"
          icon={<LifeBuoy className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">User and workspace overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                  <div className="text-sm text-gray-500 dark:text-zinc-400">Current workspace</div>
                  <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                    Client Finder
                  </div>
                  <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                    Single-workspace staging environment
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                  <div className="text-sm text-gray-500 dark:text-zinc-400">Average verification</div>
                  <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                    {averageVerificationScore}
                  </div>
                  <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                    Based on saved clients with scored verification
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                  <div className="text-sm text-gray-500 dark:text-zinc-400">Context library</div>
                  <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                    {contexts.length}
                  </div>
                  <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                    Search modifiers available to operators
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                Real user invites, role management, and workspace ownership transfer are intentionally deferred. This section establishes the admin information architecture for later integration.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System and API health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {healthBadges.map((service) => (
                <div
                  key={service.label}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{service.label}</div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                      {service.detail}
                    </div>
                  </div>
                  <Badge
                    className={
                      service.tone === "success"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300"
                    }
                  >
                    {service.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage and activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentSearches.length === 0 ? (
                <EmptyState
                  title="No recent activity"
                  description="Search activity will appear here once the workspace starts running sessions."
                  className="px-4 py-10"
                />
              ) : (
                <div className="space-y-3">
                  {recentSearches.map((session) => (
                    <Link
                      key={session.search_id}
                      to={`/search?id=${session.search_id}`}
                      className="block rounded-2xl border border-gray-200 p-4 transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {getSearchSessionQuery(session)}
                          </div>
                          <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                            {session.total_results || 0} results observed
                          </div>
                        </div>
                        <Badge variant="outline">
                          {session.created_at
                            ? new Date(session.created_at).toLocaleDateString()
                            : "Unknown date"}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Admin controls and thresholds</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Minimum verification score
                  </label>
                  <Input
                    value={thresholds.verificationMinimum}
                    onChange={(event) =>
                      setThresholds((current) => ({
                        ...current,
                        verificationMinimum: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Manual review threshold
                  </label>
                  <Input
                    value={thresholds.reviewThreshold}
                    onChange={(event) =>
                      setThresholds((current) => ({
                        ...current,
                        reviewThreshold: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Export window (days)
                  </label>
                  <Input
                    value={thresholds.exportWindow}
                    onChange={(event) =>
                      setThresholds((current) => ({
                        ...current,
                        exportWindow: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                    Automation mode
                  </label>
                  <Select
                    value={thresholds.automationMode}
                    onChange={(event) =>
                      setThresholds((current) => ({
                        ...current,
                        automationMode: event.target.value,
                      }))
                    }
                  >
                    <option value="manual-review">Manual review</option>
                    <option value="assistive">Assistive only</option>
                    <option value="future-auto">Future auto mode</option>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-500 dark:text-zinc-400">
                  Thresholds are frontend-only placeholders in this phase.
                </div>
                <Button onClick={() => setSavedMessageVisible(true)}>Save staged config</Button>
              </div>
              {savedMessageVisible ? (
                <StatusNotice
                  tone="success"
                  title="Staged configuration captured"
                  description="These controls are intentionally not persisted to the backend yet. They exist so future admin APIs can slot into a stable UI."
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Module readiness</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {moduleStatuses.map((module) => (
                <div
                  key={module.name}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 p-4 dark:border-zinc-800"
                >
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{module.name}</div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                      {module.detail}
                    </div>
                  </div>
                  <Badge
                    className={
                      module.state === "Live"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300"
                        : module.state === "Partial"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-300"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300"
                    }
                  >
                    {module.state}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <StatCard
              title="Runtime posture"
              value="Observed"
              subtitle="Using current API and workflow data"
              icon={<Gauge className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
            />
            <StatCard
              title="Operational risk"
              value={health?.status ? "Low" : "Watch"}
              subtitle="Based on current health visibility"
              icon={<AlertTriangle className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
            />
            <StatCard
              title="Data sources"
              value="4"
              subtitle="Stats, history, contexts, clients"
              icon={<Database className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
            />
            <StatCard
              title="Admin scope"
              value="Staged"
              subtitle="Frontend-first controls only"
              icon={<Settings2 className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
