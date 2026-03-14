import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Search,
  ShieldCheck,
} from "lucide-react";

import { EmptyState } from "../../components/page/EmptyState";
import { ErrorState } from "../../components/page/ErrorState";
import { LoadingState } from "../../components/page/LoadingState";
import { PageHeader } from "../../components/page/PageHeader";
import { StatusNotice } from "../../components/page/StatusNotice";
import { StatCard } from "../../components/StatCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { fetchHistory, fetchSavedClients } from "../../services/api";
import type { SearchResult } from "../../types/search-result";
import { getVerificationStatusText } from "../../types/search-result";
import type { SearchSession } from "../../types/search-session";
import { getSearchSessionQuery } from "../../types/search-session";

interface ActivityEvent {
  id: string;
  type: "search" | "client";
  title: string;
  description: string;
  timestamp?: string | null;
  href: string;
  meta: string;
}

const getTimestampValue = (timestamp?: string | null) =>
  timestamp ? new Date(timestamp).getTime() : 0;

export function ActivityPage() {
  const [history, setHistory] = useState<SearchSession[]>([]);
  const [clients, setClients] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const loadActivity = async () => {
      try {
        setIsLoading(true);
        setPageError(null);
        const [historyData, clientData] = await Promise.all([
          fetchHistory(),
          fetchSavedClients(),
        ]);

        setHistory(Array.isArray(historyData) ? historyData : historyData.history || []);
        setClients(Array.isArray(clientData) ? clientData : []);
      } catch (error) {
        console.error("Failed to load activity:", error);
        setPageError("Unable to load activity right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadActivity();
  }, []);

  const recentEvents = useMemo<ActivityEvent[]>(() => {
    const searchEvents = history.map((session) => ({
      id: `search-${session.search_id}`,
      type: "search" as const,
      title: "Search session created",
      description: getSearchSessionQuery(session),
      timestamp: session.created_at,
      href: `/search?id=${session.search_id}`,
      meta: `${session.total_results || 0} results tracked`,
    }));

    const clientEvents = clients.map((client) => ({
      id: `client-${client.result_id}`,
      type: "client" as const,
      title: "Client saved to workspace",
      description: client.business_name || "Saved business",
      timestamp: client.created_at,
      href: `/business/${client.result_id}`,
      meta: getVerificationStatusText(client),
    }));

    return [...searchEvents, ...clientEvents]
      .sort((left, right) => getTimestampValue(right.timestamp) - getTimestampValue(left.timestamp))
      .slice(0, 12);
  }, [clients, history]);

  const pendingClients = clients.filter(
    (client) =>
      client.relevance_status === "pending" || client.verification_status === "pending",
  );
  const verifiedClients = clients.filter(
    (client) => getVerificationStatusText(client) === "Verified",
  );

  if (isLoading) {
    return <LoadingState message="Loading recent activity..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load activity"
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
        title="Activity"
        description="A unified view of recent search sessions and saved-client movement without inventing analytics the backend cannot support yet."
        actions={(
          <Button asChild>
            <Link to="/search">Start a new search</Link>
          </Button>
        )}
      />

      <StatusNotice
        className="mb-8"
        title="Grounded in real workflow data"
        description="This page reuses existing search-session and saved-client patterns. It intentionally stays lightweight until deeper event logging exists."
      />

      <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Recent events"
          value={recentEvents.length.toString()}
          subtitle="Combined search and client activity"
          icon={<Activity className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Search sessions"
          value={history.length.toString()}
          subtitle="Fetched from session history"
          icon={<Search className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Pending follow-up"
          value={pendingClients.length.toString()}
          subtitle="Clients still moving through the pipeline"
          icon={<Clock3 className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Verified clients"
          value={verifiedClients.length.toString()}
          subtitle="Saved businesses with completed verification"
          icon={<ShieldCheck className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <EmptyState
                title="No recent activity yet"
                description="Run a search or save a client to start building activity history."
                className="px-4 py-12"
              />
            ) : (
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex flex-col gap-4 rounded-2xl border border-gray-200 p-4 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex gap-4">
                      <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {event.type === "search" ? (
                          <Search className="h-4 w-4" />
                        ) : (
                          <BriefcaseBusiness className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {event.title}
                        </div>
                        <div className="mt-1 text-sm text-gray-600 dark:text-zinc-300">
                          {event.description}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">
                          {event.meta}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <div className="text-sm text-gray-500 dark:text-zinc-400">
                        {event.timestamp
                          ? new Date(event.timestamp).toLocaleString()
                          : "Timestamp unavailable"}
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={event.href}>
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent searches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <EmptyState
                  title="No searches yet"
                  description="Search sessions will appear here as soon as you start exploring businesses."
                  className="px-4 py-10"
                />
              ) : (
                history.slice(0, 6).map((session) => (
                  <Link
                    key={session.search_id}
                    to={`/search?id=${session.search_id}`}
                    className="block rounded-2xl border border-gray-200 p-4 transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {getSearchSessionQuery(session)}
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                      {session.total_results || 0} results
                    </div>
                    <div className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
                      {session.created_at
                        ? new Date(session.created_at).toLocaleString()
                        : "Timestamp unavailable"}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client pipeline snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {clients.length === 0 ? (
                <EmptyState
                  title="No saved clients yet"
                  description="Quick-add businesses from Search to make this area useful."
                  className="px-4 py-10"
                />
              ) : (
                clients.slice(0, 6).map((client) => (
                  <Link
                    key={client.result_id}
                    to={`/business/${client.result_id}`}
                    className="block rounded-2xl border border-gray-200 p-4 transition hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {client.business_name || "Saved business"}
                    </div>
                    <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                      {getVerificationStatusText(client)}
                    </div>
                    <div className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
                      {client.created_at
                        ? new Date(client.created_at).toLocaleString()
                        : "Saved in current workspace"}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
