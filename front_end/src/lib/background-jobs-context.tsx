import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api, CreditError } from "./api";
import { useAuth } from "./auth-context";

export interface JobState {
  sessionId: number | null;
  totalCount: number;
  processingIds: Set<string>;
  completedIds: Set<string>;
  phaseById: Record<string, string>;
  activeItemId: string | null;
  progress: number;
  isRunning: boolean;
  isComplete: boolean;
  isPaused: boolean;
  bannerVisible: boolean;
  contextName?: string;
}

export interface RelevanceItemUpdate {
  relevance_decision?: string | null;
  relevance_score?: number | null;
  relevance_reason?: string;
}

export interface VerifyItemUpdate {
  verification_status?: string | null;
  verification_result?: string | null;
  verification_score?: number | null;
}

interface BusinessForRelevance {
  result_id: number;
  business_name: string;
  business_type: string;
  address: string;
  website: string;
}

interface BackgroundJobsContextType {
  relevanceJob: JobState | null;
  verifyJob: JobState | null;
  startRelevanceJob: (params: {
    selectedIds: string[];
    sessionId: number;
    contextId: number | null;
    contextName?: string;
    businesses: BusinessForRelevance[];
    onItemUpdate?: (id: string, partial: RelevanceItemUpdate) => void;
    onSessionRefresh?: () => void | Promise<void>;
  }) => Promise<void>;
  pauseRelevanceJob: () => void;
  dismissRelevanceBanner: () => void;
  startVerifyJob: (params: {
    validIds: number[];
    sessionId: number;
    onItemUpdate?: (id: string, partial: VerifyItemUpdate) => void;
  }) => void;
  cancelVerifyJob: () => void;
  dismissVerifyBanner: () => void;
}

const BackgroundJobsContext = createContext<BackgroundJobsContextType | null>(null);

function emptyJob(sessionId: number, totalCount: number, contextName?: string): JobState {
  return {
    sessionId,
    totalCount,
    processingIds: new Set(),
    completedIds: new Set(),
    phaseById: {},
    activeItemId: null,
    progress: 0,
    isRunning: true,
    isComplete: false,
    isPaused: false,
    bannerVisible: true,
    contextName,
  };
}

function patchJob(prev: JobState | null, patch: Partial<JobState>): JobState | null {
  if (!prev) return prev;
  return { ...prev, ...patch };
}

export function BackgroundJobsProvider({ children }: { children: ReactNode }) {
  const { refreshCredits } = useAuth();
  const [relevanceJob, setRelevanceJob] = useState<JobState | null>(null);
  const [verifyJob, setVerifyJob] = useState<JobState | null>(null);

  const pollingIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelAIRef = useRef(false);
  const relevanceOnItemUpdateRef = useRef<((id: string, partial: RelevanceItemUpdate) => void) | undefined>();
  const relevanceOnSessionRefreshRef = useRef<(() => void | Promise<void>) | undefined>();
  const verifyOnItemUpdateRef = useRef<((id: string, partial: VerifyItemUpdate) => void) | undefined>();

  useEffect(() => {
    return () => {
      pollingIntervalsRef.current.forEach(clearInterval);
      pollingIntervalsRef.current.clear();
      abortControllerRef.current?.abort();
    };
  }, []);

  const stopPollingId = useCallback((id: string) => {
    const handle = pollingIntervalsRef.current.get(id);
    if (handle !== undefined) {
      clearInterval(handle);
      pollingIntervalsRef.current.delete(id);
    }
    setVerifyJob(prev => {
      if (!prev) return prev;
      const processingIds = new Set(prev.processingIds);
      processingIds.delete(id);
      const isRunning = processingIds.size > 0;
      return patchJob(prev, {
        processingIds,
        isRunning,
        activeItemId: prev.activeItemId === id ? null : prev.activeItemId,
      })!;
    });
  }, []);

  const startVerifyPolling = useCallback(
    (id: string) => {
      let failCount = 0;
      const handle = setInterval(async () => {
        try {
          const status = await api.verificationStatus(Number(id));
          failCount = 0;
          const isTerminal =
            status.verification_status !== null &&
            status.verification_status !== undefined &&
            status.verification_status !== "processing" &&
            status.verification_status !== "skipped";

          if (!isTerminal) {
            if (status.current_phase) {
              setVerifyJob(prev => {
                if (!prev) return prev;
                return patchJob(prev, {
                  phaseById: { ...prev.phaseById, [id]: status.current_phase! },
                  activeItemId: prev.activeItemId ?? id,
                })!;
              });
            } else {
              setVerifyJob(prev =>
                prev && !prev.activeItemId ? patchJob(prev, { activeItemId: id })! : prev
              );
            }
            return;
          }

          stopPollingId(id);
          setVerifyJob(prev => {
            if (!prev) return prev;
            const completedIds = new Set(prev.completedIds).add(id);
            const processingIds = new Set(prev.processingIds);
            processingIds.delete(id);
            const phaseById = { ...prev.phaseById };
            delete phaseById[id];
            const progress = prev.totalCount > 0 ? (completedIds.size / prev.totalCount) * 100 : 100;
            const isRunning = processingIds.size > 0;
            const isComplete = !isRunning && completedIds.size >= prev.totalCount;
            return patchJob(prev, {
              completedIds,
              processingIds,
              phaseById,
              activeItemId: prev.activeItemId === id ? null : prev.activeItemId,
              progress,
              isRunning,
              isComplete,
            })!;
          });

          verifyOnItemUpdateRef.current?.(id, {
            verification_status: status.verification_status,
            verification_result: status.verification_result,
            verification_score: status.verification_score,
          });
        } catch (err) {
          failCount++;
          console.error(`Polling failed for business ${id}`, err);
          if (failCount >= 3) {
            stopPollingId(id);
          }
        }
      }, 1200);
      pollingIntervalsRef.current.set(id, handle);
    },
    [stopPollingId]
  );

  const stopRelevancePollingId = useCallback((id: string) => {
    const key = `relevance_${id}`;
    const handle = pollingIntervalsRef.current.get(key);
    if (handle !== undefined) {
      clearInterval(handle);
      pollingIntervalsRef.current.delete(key);
    }
    setRelevanceJob(prev => {
      if (!prev) return prev;
      const processingIds = new Set(prev.processingIds);
      processingIds.delete(id);
      return patchJob(prev, { processingIds })!;
    });
  }, []);

  const startRelevancePolling = useCallback(
    (id: string) => {
      const key = `relevance_${id}`;
      let failCount = 0;
      const handle = setInterval(async () => {
        try {
          const status = await api.relevancyStatus(Number(id));
          failCount = 0;
          const isTerminal =
            status.relevance_status === "completed" ||
            status.relevance_status === "failed" ||
            (status.relevance_decision !== null &&
              status.relevance_decision !== undefined &&
              status.relevance_status !== "processing");

          if (!isTerminal) {
            if (status.current_phase) {
              setRelevanceJob(prev => {
                if (!prev) return prev;
                return patchJob(prev, {
                  phaseById: { ...prev.phaseById, [id]: status.current_phase! },
                  activeItemId: prev.activeItemId ?? id,
                })!;
              });
            } else {
              setRelevanceJob(prev =>
                prev && !prev.activeItemId ? patchJob(prev, { activeItemId: id })! : prev
              );
            }
            return;
          }

          stopRelevancePollingId(id);
          setRelevanceJob(prev => {
            if (!prev) return prev;
            const completedIds = new Set(prev.completedIds).add(id);
            const processingIds = new Set(prev.processingIds);
            processingIds.delete(id);
            const phaseById = { ...prev.phaseById };
            delete phaseById[id];
            return patchJob(prev, {
              completedIds,
              processingIds,
              phaseById,
              activeItemId: prev.activeItemId === id ? null : prev.activeItemId,
            })!;
          });

          relevanceOnItemUpdateRef.current?.(id, {
            relevance_decision: status.relevance_decision,
            relevance_score: status.relevance_score,
          });
        } catch (err) {
          failCount++;
          console.error(`Relevance polling failed for business ${id}`, err);
          if (failCount >= 3) {
            stopRelevancePollingId(id);
          }
        }
      }, 1200);
      pollingIntervalsRef.current.set(key, handle);
    },
    [stopRelevancePollingId]
  );

  const pauseRelevanceJob = useCallback(() => {
    cancelAIRef.current = true;
    abortControllerRef.current?.abort();
    setRelevanceJob(prev =>
      prev ? patchJob(prev, { isRunning: false, isPaused: true })! : prev
    );
  }, []);

  const dismissRelevanceBanner = useCallback(() => {
    setRelevanceJob(null);
  }, []);

  const cancelVerifyJob = useCallback(() => {
    verifyJob?.processingIds.forEach(id => {
      const handle = pollingIntervalsRef.current.get(id);
      if (handle !== undefined) {
        clearInterval(handle);
        pollingIntervalsRef.current.delete(id);
      }
    });
    setVerifyJob(null);
  }, [verifyJob]);

  const dismissVerifyBanner = useCallback(() => {
    verifyJob?.processingIds.forEach(id => {
      const handle = pollingIntervalsRef.current.get(id);
      if (handle !== undefined) {
        clearInterval(handle);
        pollingIntervalsRef.current.delete(id);
      }
    });
    setVerifyJob(null);
  }, [verifyJob]);

  const startRelevanceJob = useCallback(
    async ({
      selectedIds,
      sessionId,
      contextId,
      contextName,
      businesses,
      onItemUpdate,
      onSessionRefresh,
    }: {
      selectedIds: string[];
      sessionId: number;
      contextId: number | null;
      contextName?: string;
      businesses: BusinessForRelevance[];
      onItemUpdate?: (id: string, partial: RelevanceItemUpdate) => void;
      onSessionRefresh?: () => void | Promise<void>;
    }) => {
      relevanceOnItemUpdateRef.current = onItemUpdate;
      relevanceOnSessionRefreshRef.current = onSessionRefresh;

      const controller = new AbortController();
      abortControllerRef.current = controller;
      cancelAIRef.current = false;

      const totalIds = selectedIds.length;
      setRelevanceJob(emptyJob(sessionId, totalIds, contextName));

      toast.info(`Running AI relevance on ${totalIds} leads…`);

      let passed = 0;
      let failed = 0;
      let creditErrorHit = false;
      let processedCount = 0;

      const processSingleLead = async (id: string): Promise<void> => {
        if (cancelAIRef.current) return;

        setRelevanceJob(prev => {
          if (!prev) return prev;
          const processingIds = new Set(prev.processingIds).add(id);
          return patchJob(prev, { activeItemId: id, processingIds })!;
        });

        const businessObject = businesses.find(b => String(b.result_id) === id);
        if (!businessObject) return;

        startRelevancePolling(id);

        try {
          if (!businessObject.website) {
            onItemUpdate?.(id, {
              relevance_decision: "skipped",
              relevance_reason: "No website — skipped",
            });
            failed++;
            return;
          }

          const response = (await api.runRelevancy(
            businessObject,
            sessionId,
            contextId,
            controller.signal
          )) as {
            relevance_decision?: string | null;
            relevance_score?: number | null;
            relevance_reason?: string | null;
            decision?: string | null;
            score?: number | null;
            reason?: string | null;
            confidence?: number | null;
          };

          const decision =
            response.relevance_decision ?? response.decision ?? null;
          const score =
            response.relevance_score != null
              ? response.relevance_score
              : response.score != null
                ? response.score
                : decision === "irrelevant"
                  ? 0
                  : response.confidence ?? null;
          const reason =
            response.relevance_reason ?? response.reason ?? undefined;

          onItemUpdate?.(id, {
            relevance_decision: decision,
            relevance_score: score,
            relevance_reason: reason,
          });
          passed++;
        } catch (err: unknown) {
          if ((err as DOMException).name === "AbortError") return;
          if (err instanceof CreditError) {
            creditErrorHit = true;
            cancelAIRef.current = true;
            controller.abort();
            return;
          }
          onItemUpdate?.(id, {
            relevance_decision: "error",
            relevance_reason: (err as Error).message,
          });
          failed++;
        } finally {
          stopRelevancePollingId(id);
          processedCount++;
          const progress = Math.min((processedCount / totalIds) * 100, 95);
          setRelevanceJob(prev => {
            if (!prev) return prev;
            const completedIds = new Set(prev.completedIds).add(id);
            const processingIds = new Set(prev.processingIds);
            processingIds.delete(id);
            const phaseById = { ...prev.phaseById };
            delete phaseById[id];
            return patchJob(prev, {
              completedIds,
              processingIds,
              phaseById,
              activeItemId: null,
              progress,
            })!;
          });
        }
      };

      const CHUNK_SIZE = 3;
      try {
        for (let i = 0; i < selectedIds.length; i += CHUNK_SIZE) {
          if (cancelAIRef.current) break;
          const chunk = selectedIds.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(id => processSingleLead(id)));
        }

        if (creditErrorHit) {
          toast.error("Credits exhausted — contact your team to top up.");
          await refreshCredits();
          setRelevanceJob(prev =>
            prev ? patchJob(prev, { isRunning: false, isPaused: true, progress: prev.progress })! : prev
          );
          return;
        }

        const wasCancelled = cancelAIRef.current;
        await onSessionRefresh?.();
        await refreshCredits();

        setRelevanceJob(prev => {
          if (!prev) return prev;
          return patchJob(prev, {
            isRunning: false,
            isComplete: !wasCancelled,
            isPaused: wasCancelled,
            progress: 100,
            activeItemId: null,
          })!;
        });

        if (wasCancelled) {
          toast.info(`AI paused: ${passed} scored, ${failed} skipped/failed`);
        } else {
          toast.success(`AI complete: ${passed} scored, ${failed} skipped/failed`);
        }
      } catch (err: unknown) {
        if (err instanceof CreditError) {
          toast.error("Credits exhausted — contact your team to top up.");
        } else {
          toast.error((err as Error).message || "AI scoring failed");
        }
        setRelevanceJob(prev =>
          prev ? patchJob(prev, { isRunning: false, isPaused: true })! : prev
        );
      }
    },
    [refreshCredits, startRelevancePolling, stopRelevancePollingId]
  );

  const startVerifyJob = useCallback(
    ({
      validIds,
      sessionId,
      onItemUpdate,
    }: {
      validIds: number[];
      sessionId: number;
      onItemUpdate?: (id: string, partial: VerifyItemUpdate) => void;
    }) => {
      verifyOnItemUpdateRef.current = onItemUpdate;

      api.verifyBatch(validIds)
        .then(() => refreshCredits())
        .catch((err: unknown) => {
          if (err instanceof CreditError) {
            toast.error("Credits exhausted — contact your team to top up.");
          } else {
            toast.error((err as Error).message || "Verification request failed");
          }
        });

      toast.info(`Verifying ${validIds.length} leads…`);

      const idStrings = validIds.map(String);
      const processingIds = new Set(idStrings);

      setVerifyJob({
        sessionId,
        totalCount: validIds.length,
        processingIds,
        completedIds: new Set(),
        phaseById: {},
        activeItemId: null,
        progress: 0,
        isRunning: true,
        isComplete: false,
        isPaused: false,
        bannerVisible: true,
      });

      idStrings.forEach(startVerifyPolling);
    },
    [refreshCredits, startVerifyPolling]
  );

  return (
    <BackgroundJobsContext.Provider
      value={{
        relevanceJob,
        verifyJob,
        startRelevanceJob,
        pauseRelevanceJob,
        dismissRelevanceBanner,
        startVerifyJob,
        cancelVerifyJob,
        dismissVerifyBanner,
      }}
    >
      {children}
    </BackgroundJobsContext.Provider>
  );
}

export function useBackgroundJobs() {
  const ctx = useContext(BackgroundJobsContext);
  if (!ctx) throw new Error("useBackgroundJobs must be used inside BackgroundJobsProvider");
  return ctx;
}
