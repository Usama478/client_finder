import { TrendingUp, Shield, AlertTriangle, Search, Target } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from './ui/badge';

interface DashboardProps {
  totalLeads: number;
  history: any[];
  onSelectHistory: (searchId: string) => Promise<void>;
  results: any[];
}

export function DashboardOverview({ totalLeads, history, onSelectHistory, results }: DashboardProps) {
  // Calculate statistics
  const verifiedCount = results.filter(b => b.is_verified || (b.verification_score && b.verification_score > 70)).length;
  const partiallyVerifiedCount = results.filter(b => !b.is_verified && b.verification_score && b.verification_score > 40 && b.verification_score <= 70).length;
  const notVerifiedCount = totalLeads - verifiedCount - partiallyVerifiedCount;

  const lowRiskCount = results.filter(b => (b.verification_score && b.verification_score > 70) || (b.relevance_score && b.relevance_score > 70)).length;
  const highRiskCount = results.filter(b => (b.verification_score && b.verification_score <= 40) || (b.relevance_score && b.relevance_score <= 40)).length;
  const mediumRiskCount = totalLeads - lowRiskCount - highRiskCount;

  const riskDistribution = [
    { name: 'Low Risk', value: lowRiskCount, color: '#22c55e' },
    { name: 'Medium Risk', value: mediumRiskCount, color: '#eab308' },
    { name: 'High Risk', value: highRiskCount, color: '#ef4444' }
  ];

  const verificationData = [
    { name: 'Verified', value: verifiedCount, color: '#22c55e' },
    { name: 'Partially Verified', value: partiallyVerifiedCount, color: '#eab308' },
    { name: 'Not Verified', value: notVerifiedCount, color: '#ef4444' }
  ];

  const stats = [
    {
      label: 'New Clients Found',
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
      label: 'Total Searches',
      value: history.length.toString(),
      change: '+1',
      icon: Search,
      trend: 'up'
    }
  ];

  const leadStats = [
    { label: 'Total Leads Found', value: totalLeads.toString(), color: 'text-blue-400' },
    { label: 'Leads in Progress', value: partiallyVerifiedCount.toString(), color: 'text-yellow-400' },
    { label: 'Verified & Converted', value: verifiedCount.toString(), color: 'text-green-400' }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white mb-2 text-2xl font-bold">Dashboard Overview</h1>
        <p className="text-gray-400">Monitor your business verification and client discovery metrics</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-gray-400" />
                </div>
                {stat.trend === 'up' && (
                  <Badge className="bg-green-500/10 text-green-400 border-green-500/20 border text-xs">
                    {stat.change}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-gray-400 mb-1">{stat.label}</div>
              <div className="text-white text-2xl font-semibold">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {totalLeads > 0 && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Risk Distribution */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-white mb-4">Risk Distribution</h3>
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
                  {riskDistribution.map((entry, index) => (
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
              {riskDistribution.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Status */}
          <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-white mb-4">Verification Status</h3>
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
                  {verificationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Activity Section */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Recent Searches */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg overflow-y-auto max-h-[400px]">
          <h3 className="text-white mb-4">Recent Searches</h3>
          {history.length === 0 ? (
            <div className="text-gray-500 text-sm">No recent searches found.</div>
          ) : (
            <div className="space-y-3">
              {history.map((search: any) => (
                <div
                  key={search.id || search.search_id}
                  className="flex items-center justify-between p-3 bg-black/30 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                  onClick={() => onSelectHistory((search.search_id || search.id).toString())}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                      <Search className="w-4 h-4 text-gray-400" />
                    </div>
                    <div>
                      <div className="text-gray-300 text-sm truncate max-w-[200px]">{search.query || search.search_query || 'Unknown Search'}</div>
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

        {/* Lead Tracking Snapshot */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg h-fit">
          <h3 className="text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-gray-400" />
            Lead Tracking Snapshot
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {leadStats.map((stat, idx) => (
              <div key={idx} className="p-4 bg-black/30 rounded-lg text-center md:text-left">
                <div className="text-sm text-gray-400 mb-2">{stat.label}</div>
                <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
