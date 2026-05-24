import { ChevronDown, ChevronUp } from "lucide-react"
import type { Campaign } from "../../../../lib/campaigns-api"
import { CampaignStatusBadge } from "./CampaignStatusBadge"
import { FIELD_LABEL } from "./constants"

interface CampaignHistoryCardProps {
  history: Campaign[]
  currentId?: number
  expanded: boolean
  onToggleExpanded: () => void
  onView: (id: number) => void
}

export function CampaignHistoryCard({
  history,
  currentId,
  expanded,
  onToggleExpanded,
  onView,
}: CampaignHistoryCardProps) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-5">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="flex items-center justify-between w-full text-left"
      >
        <div className={FIELD_LABEL}>Campaign History</div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="mt-4 space-y-2">
          {history.map(h => (
            <div
              key={h.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                currentId === h.id
                  ? "bg-blue-500/8 border-blue-500/30"
                  : "bg-muted border-border"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate" title={h.search_intent}>
                  {h.search_intent.length > 40 ? `${h.search_intent.slice(0, 40)}…` : h.search_intent}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span>{h.created_at ? new Date(h.created_at).toLocaleDateString() : "—"}</span>
                  <span>•</span>
                  <span>{h.verified_count}/{h.target_count} verified</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <CampaignStatusBadge status={h.status} />
                <button
                  type="button"
                  onClick={() => onView(h.id)}
                  className="text-[11px] px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
