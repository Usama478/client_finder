import type { CampaignStatus } from "../../../../lib/campaigns-api"

const STATUS_STYLES: Record<CampaignStatus, { className: string; label?: string }> = {
  pending: { className: "bg-slate-500/20 text-slate-400" },
  running: { className: "bg-blue-500/15 text-blue-400" },
  paused: { className: "bg-amber-500/15 text-amber-400", label: "paused" },
  completed: { className: "bg-emerald-500/12 text-emerald-400" },
  exhausted: { className: "bg-amber-500/12 text-amber-400" },
  failed: { className: "bg-red-500/12 text-red-400" },
}

interface CampaignStatusBadgeProps {
  status: CampaignStatus
  pulse?: boolean
}

export function CampaignStatusBadge({ status, pulse }: CampaignStatusBadgeProps) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${s.className}`}>
      {pulse && <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse" />}
      {s.label ?? status}
    </span>
  )
}
