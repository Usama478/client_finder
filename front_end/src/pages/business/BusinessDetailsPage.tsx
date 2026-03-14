import { useEffect, useState } from 'react';

import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { BusinessDetails } from '../../components/BusinessDetails';
import { Button } from '../../components/ui/button';
import { ErrorState } from '../../components/page/ErrorState';
import { LoadingState } from '../../components/page/LoadingState';
import { fetchSavedClients } from '../../services/api';
import type { SearchResult } from '../../types/search-result';
import { getResultId } from '../../types/search-result';
import type { BusinessDetailsNavigationState } from '../../types/workflow';

export function BusinessDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state as BusinessDetailsNavigationState | null;
  const [business, setBusiness] = useState<SearchResult | null>(navigationState?.business ?? null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchBusinessDetails(id);
    }
  }, [id]);

  const fetchBusinessDetails = async (businessId: string) => {
    setLoading(true);
    setPageError(null);

    try {
      // In Phase 1, we don't have a single-business endpoint, 
      // so we try finding it in saved clients first.
      // A robust real app would request /api/businesses/:id here
      const saved = await fetchSavedClients();
      let found: SearchResult | undefined = saved?.find((b: SearchResult) => getResultId(b) === businessId);
      
      if (found) {
        setBusiness(found);
      } else if (navigationState?.business && getResultId(navigationState.business) === businessId) {
        setBusiness(navigationState.business);
      } else {
        console.warn('Business not found in saved list. It might belong to an active search not loaded.');
        // Set an empty partial or null
        setBusiness(null); 
      }
    } catch (e) {
      console.error('Failed to load business details', e);
      if (navigationState?.business && getResultId(navigationState.business) === businessId) {
        setBusiness(navigationState.business);
      } else {
        setPageError('Unable to load business details right now.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1); // Go to previous page
  };

  if (loading) {
    return <LoadingState message="Loading business details..." className="max-w-none" />;
  }

  if (pageError) {
    return (
      <div className="p-8">
        <ErrorState
          title="Unable to load business details"
          message={pageError}
          action={(
            <Button variant="outline" onClick={handleBack}>
              {navigationState?.sourceLabel ? `Back to ${navigationState.sourceLabel}` : 'Go Back'}
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <BusinessDetails
      business={business}
      onBack={handleBack}
      backLabel={navigationState?.sourceLabel ? `Back to ${navigationState.sourceLabel}` : 'Go Back'}
    />
  );
}
