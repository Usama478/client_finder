import { TrendingUp, Shield, AlertTriangle, Search } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from './ui/badge';
import { useState, useEffect } from 'react';
import { fetchDashboardStats } from '../services/api';
import type { SearchResult } from '../types/search-result';

const getVerificationStatusText = (verificationStatus?: string | null, verification_score?: number | null) => {
  if (verificationStatus !== 'completed') return "Unverified";
  const score = verification_score ?? 0;
  if (score === 0) return "Unverified";
  if (score > 50) return "Verified";
  return "Partially Verified";
};

const getRiskLevelText = (relevance_score?: number | null) => {
  const score = relevance_score ?? 0;
  if (score === 0 || score < 40) return "High Risk";
  if (score > 70) return "Low Risk";
  return "Medium Risk";
};
interface DashboardProps {
  history: any[];
  onSelectHistory: (searchId: string) => Promise<void>;
}

export function DashboardOverview({ history, onSelectHistory }: DashboardProps) {
  const [statsData, setStatsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const data = await fetchDashboardStats();
        setStatsData(data);
      } catch (error) {
        console.error("Failed to load dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, []);
  const verifiedCount = statsData?.verified_clients || 0;
  const notVerifiedCount = statsData?.unverified_clients || 0;
  const totalLeads = statsData?.total_clients || 0;
  const globalTotalSearches = statsData?.total_searches || 0;

  const riskDistributionRaw = statsData?.risk_distribution || [];
  const verificationDataRaw = statsData?.verification_data || [];

  const clientsList: SearchResult[] = statsData?.clients || statsData?.saved_clients || statsData?.all_clients || [];

  const verificationCounts = { "Unverified": 0, "Partially Verified": 0, "Verified": 0 };
  const riskCounts = { "High Risk": 0, "Medium Risk": 0, "Low Risk": 0 };

  if (clientsList.length > 0) {
    clientsList.forEach((client) => {
      const vScore = client.verification_score ?? 0;
      const rScore = client.relevance_score ?? 0;
      verificationCounts[getVerificationStatusText(client.verification_status, vScore) as keyof typeof verificationCounts]++;
      riskCounts[getRiskLevelText(rScore) as keyof typeof riskCounts]++;
    });
  }

  const verificationData = clientsList.length > 0 ? Object.entries(verificationCounts).map(([name, value]) => ({
    name, value, color: name === 'Verified' ? '#10b981' : name === 'Partially Verified' ? '#f59e0b' : '#ef4444'
  })) : verificationDataRaw;

  const riskDistribution = clientsList.length > 0 ? Object.entries(riskCounts).map(([name, value]) => ({
    name, value, color: name === 'Low Risk' ? '#10b981' : name === 'Medium Risk' ? '#f59e0b' : '#ef4444'
  })) : riskDistributionRaw;

  const stats = [
    {
      label: 'Global Saved Clients',
      value: totalLeads.toString(),
      change: '+100%',
      icon: TrendingUp,
      trend: 'up'
    },
    {
      label: 'Verified Businesses',
      value: verifiedCount.toString(),
      change: totalLeads > 0 ? `${Math.round((verifiedCount / totalLeads) * 100)}%` : '0%',
      icon: Shield,
      trend: 'neutral'
    },
    {
      label: 'Unverified Businesses',
      value: notVerifiedCount.toString(),
      change: totalLeads > 0 ? `${Math.round((notVerifiedCount / totalLeads) * 100)}%` : '0%',
      icon: AlertTriangle,
      trend: 'neutral'
    },
    {
      label: 'Total Global Searches',
      value: globalTotalSearches.toString(),
      change: '+1',
      icon: Search,
      trend: 'up'
    }
  ];

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex justify-center items-center min-h-[50vh]">
        <div className="text-gray-500 animate-pulse">Loading global dashboard metrics...</div>
      </div>
    );
  }


  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2 text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-600 dark:text-gray-400">Monitor your business verification and client discovery metrics</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-gray-500 dark:text-zinc-400" />
                </div>
                {stat.trend === 'up' && (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 border text-xs">
                    {stat.change}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-500 dark:text-zinc-400 mb-1">{stat.label}</div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {totalLeads > 0 && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Risk Distribution */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-900 dark:text-white mb-4">Risk Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskDistribution.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 mt-4">
              {riskDistribution.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Status */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-gray-900 dark:text-white mb-4">Verification Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={verificationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="value" fill="#8884d8" radius={[8, 8, 0, 0]}>
                  {verificationData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity Section */}
      <div className="mb-8">
        {/* Recent Searches */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm overflow-y-auto max-h-[400px]">
          <h3 className="text-gray-900 dark:text-white mb-4">Recent Searches</h3>
          {history.length === 0 ? (
            <div className="text-gray-500 text-sm">No recent searches found.</div>
          ) : (
            <div className="space-y-3">
              {history.map((search: any) => (
                <div
                  key={search.search_id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-black/30 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-100 dark:bg-gray-800 transition-colors"
                  onClick={() => onSelectHistory(search.search_id.toString())}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <Search className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <div className="text-gray-700 dark:text-gray-300 text-sm truncate max-w-[200px]">{search.query || search.search_query || 'Unknown Search'}</div>
                      <div className="text-xs text-gray-500">{search.total_results || 0} results</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {search.created_at ? new Date(search.created_at).toLocaleString() : 'Date missing'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
