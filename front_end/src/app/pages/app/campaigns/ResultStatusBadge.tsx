import type { CampaignResultStatus } from "../../../../lib/campaigns-api"

const STATUS_MAP: Record<CampaignResultStatus, { className: string; label: string }> = {
  pending_relevance: { className: "bg-slate-500/20 text-slate-400", label: "Queued" },
  running_relevance: { className: "bg-blue-500/15 text-blue-400", label: "Checking…" },
  rejected_relevance: { className: "bg-red-500/12 text-red-400", label: "Rejected (rel)" },
  queued_for_verification: { className: "bg-amber-500/12 text-amber-400", label: "Awaiting verify" },
  running_verification: { className: "bg-violet-500/15 text-violet-400", label: "Verifying…" },
  rejected_verification: { className: "bg-orange-500/12 text-orange-400", label: "Rejected (ver)" },
  verified: { className: "bg-emerald-500/12 text-emerald-400", label: "✓ Verified" },
  error: { className: "bg-red-500/12 text-red-400", label: "Error" },
}

interface ResultStatusBadgeProps {
  status: CampaignResultStatus
}

export function ResultStatusBadge({ status }: ResultStatusBadgeProps) {
  const c = STATUS_MAP[status] ?? { className: "bg-slate-500/20 text-slate-400", label: status }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${c.className}`}>
      {c.label}
    </span>
  )
}
