import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  Mail,
  MailCheck,
  Send,
  Sparkles,
  UserRound,
  XCircle,
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
import { Progress } from "../../components/ui/progress";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { fetchSavedClients } from "../../services/api";
import type { SearchResult } from "../../types/search-result";
import { getVerificationStatusText } from "../../types/search-result";

type AnalyticsMetricKey =
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "replied";

const getPrimaryEmail = (client: SearchResult) =>
  client.email_found ||
  client.email_addresses?.[0] ||
  client.contact_info?.emails?.[0] ||
  null;

const templates = [
  {
    id: "intro",
    name: "Intro outreach",
    description: "First-touch message for newly qualified businesses.",
  },
  {
    id: "follow-up",
    name: "Follow-up",
    description: "Short reminder for businesses that have not responded.",
  },
  {
    id: "validation",
    name: "Validation call request",
    description: "Invite a verified lead into a next-step conversation.",
  },
];

const statusToneClassName: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  drafted: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-300",
  sent: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300",
  skipped: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300",
};

const buildDraftPreview = (client: SearchResult, templateId: string) => {
  const businessName = client.business_name || "your team";
  const templatePrefix =
    templateId === "follow-up"
      ? "Following up on a possible fit"
      : templateId === "validation"
        ? "Quick validation conversation"
        : "Helping qualified businesses convert faster";

  const subject =
    client.email_subject ||
    `${templatePrefix} for ${businessName}`;

  const body =
    client.email_body ||
    [
      `Hi ${businessName} team,`,
      "",
      "I am reaching out from Client Finder because your business surfaced as a strong match in our current qualification workflow.",
      "We already have the validation context in place and can help your team move faster from lead discovery into verified pipeline review.",
      "",
      "If useful, I can share a short walkthrough of how we would structure the next step for your business.",
      "",
      "Best,",
      "Client Finder",
    ].join("\n");

  return { subject, body };
};

export function EmailPage() {
  const [clients, setClients] = useState<SearchResult[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [templateId, setTemplateId] = useState("intro");
  const [generatedDraft, setGeneratedDraft] = useState<{ subject: string; body: string } | null>(null);
  const [workflowMessage, setWorkflowMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      try {
        setIsLoading(true);
        setPageError(null);
        const data = await fetchSavedClients();
        const savedClients = Array.isArray(data) ? data : [];
        setClients(savedClients);
        const firstEligibleClient = savedClients.find((client) => getPrimaryEmail(client));
        setSelectedClientId(firstEligibleClient?.result_id ?? null);
      } catch (error) {
        console.error("Failed to load outreach clients:", error);
        setPageError("Unable to load outreach candidates right now.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadClients();
  }, []);

  const eligibleClients = useMemo(
    () => clients.filter((client) => !!getPrimaryEmail(client)),
    [clients],
  );

  const filteredClients = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return eligibleClients;
    }

    return eligibleClients.filter((client) => {
      const target =
        `${client.business_name || ""} ${getPrimaryEmail(client) || ""} ${client.address || ""}`.toLowerCase();
      return target.includes(normalizedQuery);
    });
  }, [eligibleClients, searchQuery]);

  const selectedClient =
    eligibleClients.find((client) => client.result_id === selectedClientId) ?? null;

  const draftedCount = eligibleClients.filter(
    (client) => client.outreach_status === "drafted" || client.email_subject || client.email_body,
  ).length;
  const sentCount = eligibleClients.filter(
    (client) => client.outreach_status === "sent",
  ).length;
  const skippedCount = eligibleClients.filter(
    (client) => client.outreach_status === "skipped",
  ).length;
  const missingEmailCount = clients.length - eligibleClients.length;

  const analyticsMetrics: Array<{
    key: AnalyticsMetricKey;
    label: string;
    value: number;
    description: string;
    source: "live" | "placeholder";
  }> = [
    {
      key: "sent",
      label: "Sent",
      value: sentCount,
      description: "Observed from current outreach status data.",
      source: "live",
    },
    {
      key: "delivered",
      label: "Delivered",
      value: 0,
      description: "Reserved for mail provider delivery tracking.",
      source: "placeholder",
    },
    {
      key: "opened",
      label: "Opened",
      value: 0,
      description: "Reserved for pixel/event tracking.",
      source: "placeholder",
    },
    {
      key: "bounced",
      label: "Bounced",
      value: 0,
      description: "Reserved for provider webhooks and bounce events.",
      source: "placeholder",
    },
    {
      key: "replied",
      label: "Replied",
      value: 0,
      description: "Reserved for inbox sync or conversation logging.",
      source: "placeholder",
    },
  ];

  const sentBase = Math.max(sentCount, 1);

  if (isLoading) {
    return <LoadingState message="Loading outreach workspace..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load Email"
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
        title="Email & Outreach"
        description="A realistic outreach workspace for drafts, review, and campaign visibility, with backend-incomplete pieces clearly staged instead of hidden."
        actions={(
          <Button variant="outline" asChild>
            <Link to="/clients">Review saved clients</Link>
          </Button>
        )}
      />

      <StatusNotice
        className="mb-8"
        title="Outreach is intentionally staged"
        description="This surface reuses saved-client and contact data where available. Draft generation, send execution, and analytics tracking remain safe placeholders until the backend is ready."
      />

      <div className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Outreach-ready clients"
          value={String(eligibleClients.length)}
          subtitle="Saved clients with a usable email"
          icon={<MailCheck className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Drafted"
          value={String(draftedCount)}
          subtitle="Existing draft state or backend draft fields"
          icon={<Sparkles className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Sent"
          value={String(sentCount)}
          subtitle="Observed outreach status"
          icon={<Send className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
        <StatCard
          title="Missing email"
          value={String(missingEmailCount)}
          subtitle="Clients that still need a contact route"
          icon={<XCircle className="h-6 w-6 text-gray-500 dark:text-zinc-400" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign and draft queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by business name, email, or address"
                  className="md:max-w-sm"
                />
                <div className="flex flex-wrap gap-3 text-sm text-gray-500 dark:text-zinc-400">
                  <div>{eligibleClients.length} eligible</div>
                  <div>{draftedCount} drafted</div>
                  <div>{sentCount} sent</div>
                  <div>{skippedCount} skipped</div>
                </div>
              </div>

              {filteredClients.length === 0 ? (
                <EmptyState
                  title="No outreach-ready clients"
                  description="Save clients with valid contact emails to start building an outreach queue."
                  className="px-4 py-10"
                />
              ) : (
                <div className="space-y-3">
                  {filteredClients.map((client) => {
                    const contactEmail = getPrimaryEmail(client);
                    const isSelected = client.result_id === selectedClientId;
                    const status = client.outreach_status || "pending";

                    return (
                      <button
                        key={client.result_id}
                        type="button"
                        onClick={() => {
                          setSelectedClientId(client.result_id);
                          setGeneratedDraft(null);
                          setWorkflowMessage(null);
                        }}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                            : "border-gray-200 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/80"
                        }`}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {client.business_name || "Saved client"}
                            </div>
                            <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                              {contactEmail}
                            </div>
                            <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                              {client.address || "Address unavailable"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {getVerificationStatusText(client)}
                            </Badge>
                            <Badge className={statusToneClassName[status] || statusToneClassName.pending}>
                              {status}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email analytics and status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
                Sent counts below reuse current outreach status fields. Delivered, opened, bounced, and replied are structured now so provider or inbox tracking can drop in later without redesign.
              </div>
              <div className="space-y-3">
                {analyticsMetrics.map((metric) => {
                  const percent =
                    metric.key === "sent"
                      ? eligibleClients.length > 0
                        ? Math.round((metric.value / eligibleClients.length) * 100)
                        : 0
                      : Math.round((metric.value / sentBase) * 100);

                  return (
                    <div
                      key={metric.key}
                      className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {metric.label}
                          </div>
                          <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                            {metric.description}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                            {metric.value}
                          </div>
                          <Badge
                            className={
                              metric.source === "live"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-300"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-300"
                            }
                          >
                            {metric.source === "live" ? "Live" : "Placeholder"}
                          </Badge>
                        </div>
                      </div>
                      <Progress value={percent} className="mt-4" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Per-client outreach workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedClient ? (
                <EmptyState
                  title="Select a client"
                  description="Choose an outreach-ready client from the queue to review its staged workflow."
                  className="px-4 py-10"
                />
              ) : (
                <>
                  <div className="rounded-2xl border border-gray-200 p-4 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {selectedClient.business_name || "Saved client"}
                        </div>
                        <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                          {getPrimaryEmail(selectedClient)}
                        </div>
                        <div className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                          {selectedClient.address || "Address unavailable"}
                        </div>
                      </div>
                      <Badge variant="outline">
                        {getVerificationStatusText(selectedClient)}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                      Draft template
                    </label>
                    <Select
                      value={templateId}
                      onChange={(event) => setTemplateId(event.target.value)}
                    >
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                      {templates.find((template) => template.id === templateId)?.description}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      onClick={() => {
                        setGeneratedDraft(buildDraftPreview(selectedClient, templateId));
                        setWorkflowMessage("Draft preview generated locally. No AI or backend request was made in this phase.");
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                      Generate preview
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setWorkflowMessage("Queued for human review in the UI only. Real approval and sending flows are intentionally deferred.")
                      }
                    >
                      <Clock3 className="h-4 w-4" />
                      Queue for review
                    </Button>
                  </div>

                  {workflowMessage ? (
                    <StatusNotice
                      title="Staged outreach action"
                      description={workflowMessage}
                    />
                  ) : null}

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                      Subject
                    </label>
                    <Input
                      value={generatedDraft?.subject || selectedClient.email_subject || ""}
                      readOnly
                      placeholder="Generate a preview to inspect the subject line"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                      Draft body
                    </label>
                    <Textarea
                      value={generatedDraft?.body || selectedClient.email_body || ""}
                      readOnly
                      placeholder="Draft content will appear here when generated or when backend draft fields exist."
                      className="min-h-56"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" disabled>
                      <Send className="h-4 w-4" />
                      Send now later
                    </Button>
                    <Button variant="outline" disabled>
                      <Mail className="h-4 w-4" />
                      Schedule later
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Campaign status board</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  label: "Needs draft",
                  value: eligibleClients.filter((client) => !client.email_subject && !client.email_body && client.outreach_status !== "sent").length,
                  icon: Sparkles,
                },
                {
                  label: "Ready for review",
                  value: draftedCount,
                  icon: UserRound,
                },
                {
                  label: "Sent",
                  value: sentCount,
                  icon: CheckCircle2,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 p-4 dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                          Current staged campaign lane
                        </div>
                      </div>
                    </div>
                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {item.value}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analytics status matrix</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analyticsMetrics.map((metric) => (
                <div
                  key={metric.key}
                  className="flex items-center justify-between rounded-2xl border border-gray-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <BarChart3 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{metric.label}</div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                        {metric.source === "live" ? "Backed by current outreach status" : "Waiting for delivery analytics"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">
                      {metric.value}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400 dark:text-zinc-500">
                      {metric.source}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
