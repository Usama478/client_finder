import type { RefObject } from "react"
import type { Campaign } from "../../../../lib/campaigns-api"
import { FIELD_LABEL } from "./constants"

function LogLevel({ level }: { level: string }) {
  if (level === "error") return <span className="text-red-400">✗</span>
  if (level === "warn") return <span className="text-amber-400">⚠</span>
  return <span className="text-blue-400">›</span>
}

interface LiveLogCardProps {
  campaign: Campaign
  logRef: RefObject<HTMLDivElement | null>
}

export function LiveLogCard({ campaign, logRef }: LiveLogCardProps) {
  const entries = campaign.activity_log ?? []
  if (entries.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-[10px] p-4">
      <div className={FIELD_LABEL}>Live Log</div>
      <div ref={logRef} className="space-y-1.5 max-h-52 overflow-y-auto pr-1 mt-3">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-start gap-2 text-[12px]">
            <LogLevel level={entry.level} />
            <span className="text-muted-foreground flex-1 leading-snug">{entry.message}</span>
            <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap flex-shrink-0">
              {new Date(entry.time).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
