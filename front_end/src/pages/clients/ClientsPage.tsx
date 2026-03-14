import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';
import { Clients } from '../../components/Clients';
import { Button } from '../../components/ui/button';
import { ErrorState } from '../../components/page/ErrorState';
import { LoadingState } from '../../components/page/LoadingState';
import { fetchSavedClients, startRelevancyAgent, startVerificationAgent, toggleClientStatus } from '../../services/api';
import type { SearchResult } from '../../types/search-result';
import { getResultId } from '../../types/search-result';
import type { BusinessDetailsNavigationState } from '../../types/workflow';

export function ClientsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [processingAction, setProcessingAction] = useState<'relevancy' | 'verification' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedClients();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (processingIds.size > 0 && processingAction) {
      interval = setInterval(async () => {
        try {
          const saved = await fetchSavedClients();
          const savedResults: SearchResult[] = Array.isArray(saved) ? saved : [];
          setResults(savedResults);

          setProcessingIds((prev) => {
            const stillProcessing = new Set<string>();

            prev.forEach((id) => {
              const client = savedResults.find((result) => getResultId(result) === id);

              if (!client) {
                stillProcessing.add(id);
                return;
              }

              const isDone =
                processingAction === 'relevancy'
                  ? client.relevance_status && client.relevance_status.toLowerCase() !== 'pending'
                  : client.verification_status && client.verification_status.toLowerCase() !== 'pending';

              if (!isDone) {
                stillProcessing.add(id);
              }
            });

            if (stillProcessing.size === 0) {
              setProcessingAction(null);
            }

            return stillProcessing;
          });
        } catch (error) {
          console.error('Failed to refresh client processing statuses:', error);
        }
      }, 3000);
    }

    return () => clearInterval(interval);
  }, [processingAction, processingIds.size]);

  const loadSavedClients = async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
      setActionError(null);
    } else {
      setIsLoading(true);
      setPageError(null);
    }

    try {
      const saved = await fetchSavedClients();
      if (Array.isArray(saved)) {
        setResults(saved);
      }
    } catch (err) {
      console.error('Failed to load saved clients:', err);
      if (options?.silent) {
        setActionError('Unable to refresh Clients right now. Showing the most recent data we have.');
      } else {
        setPageError('Unable to load saved clients right now.');
      }
    } finally {
      if (options?.silent) {
        setIsRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  const handleSelectBusiness = (businessId: string) => {
    const business = results.find((result) => getResultId(result) === businessId) ?? null;
    const detailsState: BusinessDetailsNavigationState = {
      business,
      sourceStage: 'clients',
      sourceLabel: 'Clients',
    };

    navigate(`/business/${businessId}`, { state: detailsState });
  };

  const handleRunRelevancy = async (ids: string[]) => {
    setActionError(null);
    setProcessingIds((prev: Set<string>) => new Set([...prev, ...ids]));
    setProcessingAction('relevancy');
    try {
      await startRelevancyAgent(ids);
      await loadSavedClients({ silent: true });
    } catch (error: any) {
      console.error(error);
      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setProcessingAction(null);
      setActionError(error.response?.data?.detail || 'Unable to start a relevancy rerun for the selected clients.');
    }
  };

  const handleRunVerification = async (ids: string[]) => {
    setActionError(null);
    setProcessingIds((prev: Set<string>) => new Set([...prev, ...ids]));
    setProcessingAction('verification');
    try {
      await startVerificationAgent(ids);
      await loadSavedClients({ silent: true });
    } catch (error: any) {
      console.error(error);
      setProcessingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setProcessingAction(null);
      setActionError(error.response?.data?.detail || 'Unable to start a validation rerun for the selected clients.');
    }
  };

  const handleRemoveFromClients = async (ids: string[]) => {
    try {
      setActionError(null);
      await Promise.all(ids.map((id: string) => toggleClientStatus(id, false)));
      setResults((prev: SearchResult[]) => prev.filter((r: SearchResult) => !ids.includes(getResultId(r))));
    } catch (err) {
      console.error('Failed to remove from clients:', err);
      setActionError('Unable to remove one or more businesses from Clients right now.');
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading saved clients..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load Clients"
          message={pageError}
          action={(
            <Button variant="outline" onClick={() => loadSavedClients()}>
              Try Again
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <Clients
      actionError={actionError}
      isRefreshing={isRefreshing}
      results={results}
      processingIds={processingIds}
      processingAction={processingAction}
      onRefresh={() => loadSavedClients({ silent: true })}
      onSelectBusiness={handleSelectBusiness}
      onRunRelevancy={handleRunRelevancy}
      onRunVerification={handleRunVerification}
      onRemoveFromClients={handleRemoveFromClients}
    />
  );
}
