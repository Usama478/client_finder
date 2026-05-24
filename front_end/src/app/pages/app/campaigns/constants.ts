import type { CampaignResultStatus } from "../../../../lib/campaigns-api"

export const FIELD_LABEL = "text-[10px] font-semibold text-muted-foreground uppercase tracking-widest"

export const PASSED_RELEVANCE_STATUSES: CampaignResultStatus[] = [
  "queued_for_verification",
  "running_verification",
  "rejected_verification",
  "verified",
]

export function isPassedRelevance(status: CampaignResultStatus | "" | undefined): boolean {
  if (!status) return false
  return PASSED_RELEVANCE_STATUSES.includes(status)
}
