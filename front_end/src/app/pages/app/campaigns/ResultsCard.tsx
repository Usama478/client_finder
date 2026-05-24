import { Save, ExternalLink } from "lucide-react"
import { Link } from "react-router"
import type { CampaignResult, CampaignResultStatus } from "../../../../lib/campaigns-api"
import { FIELD_LABEL, isPassedRelevance } from "./constants"
import { ResultStatusBadge } from "./ResultStatusBadge"

interface ResultsCardProps {
  results: CampaignResult[]
  filteredResults: CampaignResult[]
  activeTab: "all" | "passed" | "verified"
  passedCount: number
  verifiedCount: number
  savingId: number | null
  onTabChange: (tab: "all" | "passed" | "verified") => void
  onSave: (result: CampaignResult) => void
}

export function ResultsCard({
  results,
  filteredResults,
  activeTab,
  passedCount,
  verifiedCount,
  savingId,
  onTabChange,
  onSave,
}: ResultsCardProps) {
  const tabs = [
    { id: "all" as const, label: `All (${results.length})` },
    { id: "passed" as const, label: `Relevance passed (${passedCount})` },
    { id: "verified" as const, label: `Verified (${verifiedCount})` },
  ]

  return (
    <div className="bg-card border border-border rounded-[10px] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className={FIELD_LABEL}>Results</div>
        <div className="flex gap-1 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                activeTab === tab.id
                  ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                  : "bg-muted border-border text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredResults.length === 0 && (
          <div className="py-6 text-center text-muted-foreground text-sm">
            No results in this category yet.
          </div>
        )}
        {filteredResults.map(r => (
          <ResultRow key={r.result_id} result={r} savingId={savingId} onSave={onSave} />
        ))}
      </div>
    </div>
  )
}

function ResultRow({
  result: r,
  savingId,
  onSave,
}: {
  result: CampaignResult
  savingId: number | null
  onSave: (result: CampaignResult) => void
}) {
  const status = (r.campaign_status || "pending_relevance") as CampaignResultStatus
  const reasonSnippet = r.relevance_reason?.trim() || r.relevance_decision || r.verification_result || null

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted border border-border">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {r.business_name || r.website}
          </span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
              r.source === "maps"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-violet-500/15 text-violet-400"
            }`}
          >
            {r.source?.toUpperCase()}
          </span>
          {r.campaign_pass > 1 && (
            <span className="text-[10px] text-muted-foreground">Pass {r.campaign_pass}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {r.website && (
            <a
              href={r.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-400/70 hover:text-blue-400 flex items-center gap-0.5 truncate max-w-[200px]"
            >
              {r.website.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
            </a>
          )}
          {r.primary_email && (
            <a
              href={`mailto:${r.primary_email}`}
              className="text-[11px] text-emerald-400/80 hover:text-emerald-400 truncate max-w-[180px]"
              title={r.primary_email}
            >
              {r.primary_email}
            </a>
          )}
          {r.confidence !== null && r.confidence !== undefined && (
            <span className="text-[11px] text-muted-foreground">
              rel: {r.confidence <= 1 ? Math.round(r.confidence * 100) : r.confidence}%
            </span>
          )}
          {r.verification_score !== null && r.verification_score !== undefined && (
            <span className="text-[11px] text-muted-foreground">ver: {r.verification_score}</span>
          )}
        </div>
        {reasonSnippet && (
          <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2" title={reasonSnippet}>
            {reasonSnippet}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <ResultStatusBadge status={status} />
        <Link
          to={`/app/business/${r.result_id}`}
          className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Details
        </Link>
        <button
          type="button"
          onClick={() => onSave(r)}
          disabled={r.is_saved_client || savingId === r.result_id}
          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg font-semibold transition-all disabled:opacity-50 border ${
            r.is_saved_client
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-blue-500/15 border-blue-500/30 text-blue-400"
          }`}
        >
          <Save className="h-3 w-3" />
          {r.is_saved_client ? "Saved" : savingId === r.result_id ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  )
}
