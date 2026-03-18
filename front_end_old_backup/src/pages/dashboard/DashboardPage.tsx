import { useEffect, useState } from 'react';

import { DashboardOverview } from '../../components/DashboardOverview';
import { fetchHistory } from '../../services/api';
import { useNavigate } from 'react-router-dom';

export function DashboardPage() {
  const [history, setHistory] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await fetchHistory();
      setHistory(Array.isArray(data) ? data : data.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setHistory([]);
    }
  };

  const handleSelectHistory = async (searchId: string) => {
    navigate(`/search?id=${searchId}`);
  };

  return (
    <DashboardOverview
      history={history}
      onSelectHistory={handleSelectHistory}
    />
  );
}
