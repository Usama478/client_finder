import { useEffect, useMemo, useRef, useState } from "react"
import { Play } from "lucide-react"
import { useSearchParams } from "react-router"
import { api } from "../../../lib/api"
import {
  campaignsApi,
  Campaign,
  CampaignResult,
  CampaignStatus,
  CostEstimate,
} from "../../../lib/campaigns-api"
import { toast } from "sonner"
import { usePageState } from "../../../lib/app-state-context"
import { SetupForm } from "./campaigns/SetupForm"
import { CampaignHistoryCard } from "./campaigns/CampaignHistoryCard"
import { CampaignProgressCard } from "./campaigns/CampaignProgressCard"
import { LiveLogCard } from "./campaigns/LiveLogCard"
import { ResultsCard } from "./campaigns/ResultsCard"
import { isPassedRelevance } from "./campaigns/constants"

export default function CampaignEnginePage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [campState, setCampState] = usePageState("campaign")
  const { intent, contextId, targetCount, threshold, budget, platform, activeTab, historyExpanded } = campState
  const [contexts, setContexts] = useState<{ id: number; name: string }[]>([])
  const [estimate, setEstimate] = useState<CostEstimate | null>(null)
  const [credits, setCredits] = useState<number | null>(null)
  const [launching, setLaunching] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [formError, setFormError] = useState("")

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [results, setResults] = useState<CampaignResult[]>([])
  const [savingId, setSavingId] = useState<number | null>(null)
  const [history, setHistory] = useState<Campaign[]>([])
  const [pollingError, setPollingError] = useState(false)

  const logRef = useRef<HTMLDivElement>(null)
  const historyAutoExpandDone = useRef(false)

  useEffect(() => {
    api.contexts().then((c: { id: number; name: string }[]) => setContexts(c || [])).catch(() => {})
    api.credits().then(c => setCredits(c?.credits_remaining ?? 0)).catch(() => setCredits(0))
  }, [])

  const campaignIdFromUrl = searchParams.get("campaign")
  const urlCampaignId = campaignIdFromUrl ? Number(campaignIdFromUrl) : null

  useEffect(() => {
    if (urlCampaignId && !Number.isFinite(urlCampaignId)) return

    if (urlCampaignId) {
      if (campaign?.id === urlCampaignId) {
        campaignsApi.list().then(h => setHistory(h || [])).catch(() => {})
        return
      }
      Promise.all([
        campaignsApi.get(urlCampaignId),
        campaignsApi.getResults(urlCampaignId),
        campaignsApi.list(),
      ])
        .then(([c, r, h]) => {
          setCampaign(c)
          setResults(r || [])
          setHistory(h || [])
        })
        .catch(() => {
          campaignsApi.list().then(h => setHistory(h || [])).catch(() => {})
        })
      return
    }

    if (!campaign) {
      Promise.all([campaignsApi.getActive(), campaignsApi.list()])
        .then(([c, h]) => {
          setHistory(h || [])
          if (c) {
            setCampaign(c)
            return campaignsApi.getResults(c.id)
          }
          return [] as CampaignResult[]
        })
        .then(r => {
          if (r && r.length > 0) setResults(r)
        })
        .catch(() => {})
    }
  }, [urlCampaignId, campaign?.id])

  useEffect(() => {
    if (history.length > 0 && !historyAutoExpandDone.current && !historyExpanded) {
      historyAutoExpandDone.current = true
      setCampState({ historyExpanded: true })
    }
  }, [history.length, historyExpanded, setCampState])

  useEffect(() => {
    if (campaign) return
    const t = setTimeout(() => {
      campaignsApi.estimate(targetCount, platform).then(setEstimate).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [targetCount, platform, campaign])

  useEffect(() => {
    if (!campaign || (campaign.status !== "running" && campaign.status !== "pending")) return
    setPollingError(false)
    let failCount = 0
    const iv = setInterval(async () => {
      try {
        const updated = await campaignsApi.get(campaign.id)
        setCampaign(updated)
        const r = await campaignsApi.getResults(campaign.id)
        setResults(r ?? [])
        failCount = 0
      } catch {
        failCount++
        if (failCount >= 3) {
          clearInterval(iv)
          setPollingError(true)
        }
      }
    }, 4000)
    return () => clearInterval(iv)
  }, [campaign?.id, campaign?.status])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [campaign?.activity_log?.length])

  async function handleLaunch() {
    if (!intent.trim()) {
      setFormError("Please describe what you're looking for.")
      return
    }
    if (!Number.isFinite(targetCount) || targetCount < 1 || targetCount > 50) {
      setFormError("Target must be between 1 and 50 verified clients.")
      return
    }
    if (!Number.isFinite(budget) || budget < 5) {
      setFormError("Minimum budget is 5 credits.")
      return
    }
    if (credits !== null && budget > credits) {
      setFormError(`Budget exceeds your balance (${credits} credits).`)
      return
    }
    setFormError("")
    setLaunching(true)
    try {
      const c = await campaignsApi.create({
        search_intent: intent,
        context_id: contextId,
        target_count: targetCount,
        relevance_threshold: threshold,
        credit_budget: budget,
        discovery_platform: platform,
      })
      setCampaign(c)
      setSearchParams({ campaign: String(c.id) })
      setResults([])
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to launch campaign."
      setFormError(message)
    } finally {
      setLaunching(false)
    }
  }

  async function handleCancel() {
    if (!campaign) return
    try {
      const res = await campaignsApi.cancel(campaign.id)
      const nextStatus: CampaignStatus = res.status === "paused" ? res.status : "paused"
      setCampaign(prev => (prev ? { ...prev, status: nextStatus } : null))
      toast.success("Campaign paused")
    } catch {
      toast.error("Failed to stop campaign")
    }
  }

  function handleReset() {
    setCampaign(null)
    setResults([])
    setCampState({
      intent: "",
      contextId: null,
      targetCount: 10,
      threshold: 60,
      budget: 50,
      platform: "both",
      activeTab: "all",
    })
    setEstimate(null)
    setFormError("")
    setSearchParams({})
  }

  async function handleSave(result: CampaignResult) {
    if (!campaign) return
    setSavingId(result.result_id)
    try {
      await campaignsApi.saveClient(campaign.id, result.result_id)
      setResults(prev =>
        prev.map(r => (r.result_id === result.result_id ? { ...r, is_saved_client: true } : r))
      )
      toast.success("Client saved")
    } catch {
      toast.error("Failed to save client")
    } finally {
      setSavingId(null)
    }
  }

  function handleViewHistory(id: number) {
    setCampState({ historyExpanded: true })
    setSearchParams({ campaign: String(id) })
  }

  function handleBackToCampaigns() {
    setCampaign(null)
    setResults([])
    setSearchParams({})
    setCampState({ historyExpanded: true })
  }

  async function handleResume() {
    if (!campaign) return
    setResuming(true)
    try {
      const updated = await campaignsApi.resume(campaign.id)
      setCampaign(updated)
      toast.success("Campaign resumed")
    } catch {
      toast.error("Failed to resume campaign")
    } finally {
      setResuming(false)
    }
  }

  const isRunning = campaign?.status === "running" || campaign?.status === "pending"
  const isPaused = campaign?.status === "paused"
  const isDone = campaign && !isRunning && !isPaused

  const filteredResults = useMemo(() => {
    return (results ?? []).filter(r => {
      if (activeTab === "passed") return isPassedRelevance(r.campaign_status)
      if (activeTab === "verified") return r.campaign_status === "verified"
      return true
    })
  }, [results, activeTab])

  const pendingCount = useMemo(
    () => (results ?? []).filter(r => r.campaign_status === "pending_relevance").length,
    [results]
  )

  const passedCount = useMemo(
    () => (results ?? []).filter(r => isPassedRelevance(r.campaign_status)).length,
    [results]
  )

  const verifiedCount = useMemo(
    () => (results ?? []).filter(r => r.campaign_status === "verified").length,
    [results]
  )

  const progressPct = useMemo(
    () => (campaign ? Math.round((campaign.verified_count / campaign.target_count) * 100) : 0),
    [campaign]
  )

  const creditPct = useMemo(
    () => (campaign ? Math.round((campaign.credits_used / campaign.credit_budget) * 100) : 0),
    [campaign]
  )

  const showResume =
    campaign &&
    (campaign.status === "paused" ||
      campaign.status === "exhausted" ||
      (campaign.status === "failed" && pendingCount > 0) ||
      (campaign.status === "completed" && pendingCount > 0))

  const resumeLabel =
    pendingCount > 0
      ? `Process Remaining ${pendingCount} Discovered Candidates`
      : "Resume Campaign"

  return (
    <div className="p-6 page-enter">
      <div className="flex flex-col gap-5">
        <div className="w-full">
          <SetupForm
            campState={campState}
            setCampState={setCampState}
            contexts={contexts}
            estimate={estimate}
            credits={credits}
            launching={launching}
            formError={formError}
            campaignActive={!!campaign}
            isDone={!!isDone}
            onLaunch={handleLaunch}
            onReset={handleReset}
          />
        </div>

        <div className="w-full space-y-5">
          {campaign && (
            <>
              <CampaignProgressCard
                campaign={campaign}
                isRunning={isRunning}
                progressPct={progressPct}
                creditPct={creditPct}
                onBack={handleBackToCampaigns}
                onCancel={handleCancel}
              />
              {pollingError && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                  Live updates unavailable — refresh manually.
                </div>
              )}
              <LiveLogCard campaign={campaign} logRef={logRef} />
              {results.length > 0 && (
                <ResultsCard
                  results={results}
                  filteredResults={filteredResults}
                  activeTab={activeTab}
                  passedCount={passedCount}
                  verifiedCount={verifiedCount}
                  savingId={savingId}
                  onTabChange={tab => setCampState({ activeTab: tab })}
                  onSave={handleSave}
                />
              )}
              {showResume && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={resuming}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm text-white transition-all bg-gradient-to-br from-amber-500 to-amber-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Play className="h-4 w-4" />
                    {resuming ? "Resuming…" : resumeLabel}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {(history.length > 0 || campaign) && (
          <CampaignHistoryCard
            history={history}
            currentId={campaign?.id}
            expanded={historyExpanded}
            onToggleExpanded={() => setCampState({ historyExpanded: !historyExpanded })}
            onView={handleViewHistory}
          />
        )}
      </div>
    </div>
  )
}
