import { useEffect, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { BusinessValidation } from '../../components/BusinessValidation';
import { ErrorState } from '../../components/page/ErrorState';
import { LoadingState } from '../../components/page/LoadingState';
import { fetchResults, startVerificationAgent, toggleClientStatus } from '../../services/api';
import type { SearchResult } from '../../types/search-result';
import { getResultId } from '../../types/search-result';
import type { BusinessDetailsNavigationState } from '../../types/workflow';

export function ValidationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { selectedIds?: string[], searchId?: string } | null;
  
  const [results, setResults] = useState<SearchResult[]>([]);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const activeValidationIds = state?.selectedIds || [];

  useEffect(() => {
    if (!state?.searchId && activeValidationIds.length === 0) {
      navigate('/search');
      return;
    }

    if (state?.searchId) {
      setIsLoading(true);
      setPageError(null);

      fetchResults(state.searchId)
        .then((res: SearchResult) => {
          const newRes: SearchResult[] = Array.isArray(res) ? res : [];
          setResults(newRes);

          if (activeValidationIds.length > 0) {
            setProcessingIds(new Set(activeValidationIds));
            startVerificationAgent(activeValidationIds).catch(console.error);
          }
        })
        .catch((error: any) => {
          console.error('Failed to load validation results:', error);
          setPageError(error.response?.data?.detail || 'Unable to load validation results for this search.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [state?.searchId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (processingIds.size > 0 && state?.searchId) {
      interval = setInterval(async () => {
        try {
          const res = await fetchResults(state.searchId!);
          const newRes: SearchResult[] = Array.isArray(res) ? res : [];
          setResults(newRes);
          
          setProcessingIds((prev: Set<string>) => {
            const stillProcessing = new Set<string>();
            prev.forEach((idStr: string) => {
              const r = newRes.find((res: SearchResult) => getResultId(res) === idStr);
              if (r) {
                const isDone = r.verification_status && r.verification_status.toLowerCase() !== 'pending';
                if (!isDone) stillProcessing.add(idStr);
              }
            });
            return stillProcessing;
          });
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [processingIds.size, state?.searchId]);

  const handleAddMultipleToClients = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id: string) => toggleClientStatus(id, true)));
      navigate('/clients');
    } catch (err) {
      console.error('Failed to add multiple to clients:', err);
    }
  };

  const handleBusinessSelect = (businessId: string) => {
    const business = results.find((result) => getResultId(result) === businessId) ?? null;
    const detailsState: BusinessDetailsNavigationState = {
      business,
      sourceStage: 'validation',
      sourceLabel: 'Validation',
      searchId: state?.searchId ?? null,
    };

    navigate(`/business/${businessId}`, { state: detailsState });
  };

  const handleBack = () => {
    navigate(state?.searchId ? `/search?id=${state.searchId}` : '/search');
  };

  const displayResults = results.filter((r: SearchResult) => activeValidationIds.includes(getResultId(r)));

  if (isLoading) {
    return <LoadingState message="Loading validation results..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load validation results"
          message={pageError}
          action={(
            <Button variant="outline" onClick={handleBack}>
              Back to Search
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <BusinessValidation
      results={displayResults}
      processingIds={processingIds}
      searchId={state?.searchId ?? null}
      onAddToClients={handleAddMultipleToClients}
      onBack={handleBack}
      onSelectBusiness={handleBusinessSelect}
    />
  );
}
