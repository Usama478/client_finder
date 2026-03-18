import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, FileText, Receipt, Users } from "lucide-react";

import { PageHeader } from "../../components/page/PageHeader";
import { StatusNotice } from "../../components/page/StatusNotice";
import { StatCard } from "../../components/StatCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { fetchHistory, fetchSavedClients } from "../../services/api";
import type { SearchResult } from "../../types/search-result";
import type { SearchSession } from "../../types/search-session";

export function BillingPage() {
  const [history, setHistory] = useState<SearchSession[]>([]);
  const [clients, setClients] = useState<SearchResult[]>([]);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const [historyData, clientData] = await Promise.all([
          fetchHistory(),
          fetchSavedClients(),
        ]);
        setHistory(Array.isArray(historyData) ? historyData : historyData.history || []);
        setClients(Array.isArray(clientData) ? clientData : []);
      } catch (error) {
        console.error("Failed to load billing usage data:", error);
        setUsageError("Live usage counters are temporarily unavailable. Plan surfaces below remain placeholder-safe.");
      }
    };

    void loadUsage();
  }, []);

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlySearches = useMemo(
    () =>
      history.filter((session) => {
        if (!session.created_at) {
          return false;
        }

        const sessionDate = new Date(session.created_at);
        return (
          sessionDate.getMonth() === currentMonth &&
          sessionDate.getFullYear() === currentYear
        );
      }).length,
    [currentMonth, currentYear, history],
  );

  const monthlySavedClients = useMemo(
    () =>
      clients.filter((client) => {
        if (!client.created_at) {
          return false;
        }

        const clientDate = new Date(client.created_at);
        return (
          clientDate.getMonth() === currentMonth &&
          clientDate.getFullYear() === currentYear
        );
      }).length,
    [clients, currentMonth, currentYear],
  );

  return (
    <div className="mx-auto max-w-7xl p-8">
      <PageHeader
        title="Billing"
        description="A clean placeholder for subscription management, usage visibility, and future self-serve billing actions."
        actions={(
          <Button variant="outline" asChild>
            <Link to="/settings">Review workspace settings</Link>
          </Button>
        )}
      />

      <StatusNotice
        tone="warning"
        className="mb-6"
        title="Billing is intentionally placeholder-safe"
        description="No payment processor or subscription backend is connected in this phase. The plan and invoice surfaces are here to make future integration straightforward."
      />

      {usageError ? (
        <StatusNotice
          className="mb-8"
          title="Usage counters are partial"
          description={usageError}
        />
      ) : null}

      <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Current plan"
          value="Starter"
          subtitle="Frontend placeholder tier"
          icon={<CreditCard className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Observed searches"
          value={monthlySearches.toString()}
          subtitle="This month from existing history data"
          icon={<FileText className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Saved clients"
          value={monthlySavedClients.toString()}
          subtitle="This month from current workspace data"
          icon={<Users className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Invoices"
          value="0"
          subtitle="Will populate when billing backend lands"
          icon={<Receipt className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Plan overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/50 dark:bg-blue-950/20">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
                    Starter
                  </div>
                  <div className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">
                    $0 during migration
                  </div>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 dark:text-zinc-300">
                    Includes guided search workflow access, client management surfaces,
                    contexts, activity history, and placeholder account screens.
                  </p>
                </div>
                <Button disabled>Upgrade coming soon</Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Included in this phase
                </div>
                <div className="mt-3 space-y-2 text-sm text-gray-500 dark:text-zinc-400">
                  <div>Search and saved-client workflow</div>
                  <div>Context creation and selection</div>
                  <div>Settings, activity, and auth surfaces</div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  Deferred billing work
                </div>
                <div className="mt-3 space-y-2 text-sm text-gray-500 dark:text-zinc-400">
                  <div>Payment methods and checkout</div>
                  <div>Proration, taxes, and invoice PDFs</div>
                  <div>Seat management and billing webhooks</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Search sessions
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                      Observed workspace activity this month
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {monthlySearches}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      Clients added
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                      Observed saved-client activity this month
                    </div>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {monthlySavedClients}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                Usage limits, overages, and entitlements will be driven by the billing backend later. For now, these counters simply show visible workspace activity.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Invoices & payment method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                No invoices yet. This section is reserved for future Stripe or payment-provider integration.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" disabled>
                  Add payment method
                </Button>
                <Button variant="outline" disabled>
                  Download invoices
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
