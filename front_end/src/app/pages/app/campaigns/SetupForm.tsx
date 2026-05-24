import { Zap, Play, RefreshCw } from "lucide-react"
import type { CostEstimate, DiscoveryPlatform } from "../../../../lib/campaigns-api"
import type { CampaignPageState } from "../../../../lib/app-state-context"
import { FIELD_LABEL } from "./constants"

interface SetupFormProps {
  campState: CampaignPageState
  setCampState: (value: Partial<CampaignPageState>) => void
  contexts: { id: number; name: string }[]
  estimate: CostEstimate | null
  credits: number | null
  launching: boolean
  formError: string
  campaignActive: boolean
  isDone: boolean
  onLaunch: () => void
  onReset: () => void
}

export function SetupForm({
  campState,
  setCampState,
  contexts,
  estimate,
  credits,
  launching,
  formError,
  campaignActive,
  isDone,
  onLaunch,
  onReset,
}: SetupFormProps) {
  const { intent, contextId, targetCount, threshold, budget, platform } = campState
  const formLocked = campaignActive
  const launchDisabled =
    launching ||
    formLocked ||
    !intent.trim() ||
    !Number.isFinite(targetCount) ||
    targetCount < 1 ||
    targetCount > 50 ||
    !Number.isFinite(budget) ||
    budget < 5 ||
    (credits !== null && budget > credits)

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 lg:sticky lg:top-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-bold text-base text-foreground flex items-center gap-2 font-[Syne,sans-serif]">
            <Zap className="h-4 w-4 text-blue-400" /> Campaign Engine
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            Automate discovery → relevance → verification in one pass
          </div>
        </div>
        {isDone && (
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" /> New Campaign
          </button>
        )}
      </div>

      <div
        className={`grid grid-cols-1 gap-4 ${formLocked ? "opacity-50" : ""}`}
        aria-disabled={formLocked}
      >
        <div>
          <label className={FIELD_LABEL}>What are you looking for?</label>
          <textarea
            value={intent}
            onChange={e => setCampState({ intent: e.target.value })}
            rows={2}
            disabled={formLocked}
            placeholder="e.g. US women's fashion retailers, UK homeware brands, German industrial suppliers…"
            className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-muted border border-border disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className={FIELD_LABEL}>AI Context (optional)</label>
          <select
            value={contextId ?? ""}
            onChange={e => setCampState({ contextId: e.target.value ? Number(e.target.value) : null })}
            disabled={formLocked}
            className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 bg-muted border border-border disabled:cursor-not-allowed"
          >
            <option value="">No context</option>
            {contexts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={FIELD_LABEL}>Discovery Platform</label>
          <div className="flex gap-2 mt-1.5">
            {(["maps", "serp", "both"] as const).map(p => (
              <button
                key={p}
                type="button"
                disabled={formLocked}
                onClick={() => setCampState({ platform: p as DiscoveryPlatform })}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all border disabled:cursor-not-allowed ${
                  platform === p
                    ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                    : "bg-muted border-border text-muted-foreground"
                }`}
              >
                {p === "maps" ? "Google Maps" : p === "serp" ? "Web Search" : "Both"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={FIELD_LABEL}>Target Verified Clients</label>
          <input
            type="number"
            min={1}
            max={50}
            value={targetCount}
            onChange={e => {
              const v = Number(e.target.value)
              setCampState({ targetCount: Number.isFinite(v) ? v : 1 })
            }}
            disabled={formLocked}
            className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 bg-muted border border-border disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className={FIELD_LABEL}>
            Max Credits&nbsp;
            {credits !== null && <span className="text-blue-400">(you have {credits})</span>}
          </label>
          <input
            type="number"
            min={5}
            value={budget}
            onChange={e => {
              const v = Number(e.target.value)
              setCampState({ budget: Number.isFinite(v) ? v : 5 })
            }}
            disabled={formLocked}
            className="w-full mt-1.5 px-3 py-2 rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500 bg-muted border border-border disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className={FIELD_LABEL}>Minimum Relevance Threshold — {threshold}%</label>
          <input
            type="range"
            min={40}
            max={90}
            value={threshold}
            onChange={e => setCampState({ threshold: Number(e.target.value) })}
            disabled={formLocked}
            className="w-full mt-2 accent-blue-500 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
            <span>40% (broader)</span>
            <span>90% (stricter)</span>
          </div>
        </div>
      </div>

      {estimate && !campaignActive && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] bg-blue-500/8 border border-blue-500/20">
          <Zap className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-muted-foreground">Estimated cost:</span>
          <span className="font-bold text-blue-400">{estimate.low}–{estimate.high} credits</span>
          <span className="text-muted-foreground ml-2">
            (~{estimate.breakdown.estimated_passes} pass{estimate.breakdown.estimated_passes !== 1 ? "es" : ""},{" "}
            {estimate.breakdown.total_candidates} candidates)
          </span>
        </div>
      )}

      {formError && (
        <div className="mt-3 text-[12px] text-red-400 px-3 py-2 rounded-lg bg-red-500/10">
          {formError}
        </div>
      )}

      {!campaignActive && (
        <button
          type="button"
          onClick={onLaunch}
          disabled={launchDisabled}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-all disabled:opacity-50 bg-gradient-to-br from-blue-600 to-indigo-600 disabled:from-muted disabled:to-muted"
        >
          <Play className="h-4 w-4" />
          {launching ? "Launching…" : "Launch Campaign"}
        </button>
      )}
    </div>
  )
}
