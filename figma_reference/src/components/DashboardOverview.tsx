import { TrendingUp, Shield, AlertTriangle, Search, Target, CheckCircle, Clock } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { mockBusinesses, recentSearches, alerts } from '../data/mockData';
import { Badge } from './ui/badge';

export function DashboardOverview() {
  // Calculate statistics
  const verifiedCount = mockBusinesses.filter(b => b.verificationStatus === 'verified').length;
  const partiallyVerifiedCount = mockBusinesses.filter(b => b.verificationStatus === 'partially-verified').length;
  const notVerifiedCount = mockBusinesses.filter(b => b.verificationStatus === 'not-verified').length;
  
  const riskDistribution = [
    { name: 'Low Risk', value: mockBusinesses.filter(b => b.riskScore === 'low').length, color: '#22c55e' },
    { name: 'Medium Risk', value: mockBusinesses.filter(b => b.riskScore === 'medium').length, color: '#eab308' },
    { name: 'High Risk', value: mockBusinesses.filter(b => b.riskScore === 'high').length, color: '#ef4444' }
  ];

  const verificationData = [
    { name: 'Verified', value: verifiedCount, color: '#22c55e' },
    { name: 'Partially Verified', value: partiallyVerifiedCount, color: '#eab308' },
    { name: 'Not Verified', value: notVerifiedCount, color: '#ef4444' }
  ];

  const stats = [
    {
      label: 'New Clients Found',
      value: '24',
      change: '+12%',
      icon: TrendingUp,
      trend: 'up'
    },
    {
      label: 'Verified Businesses',
      value: verifiedCount.toString(),
      change: `${Math.round((verifiedCount / mockBusinesses.length) * 100)}%`,
      icon: Shield,
      trend: 'neutral'
    },
    {
      label: 'Unverified Businesses',
      value: notVerifiedCount.toString(),
      change: `${Math.round((notVerifiedCount / mockBusinesses.length) * 100)}%`,
      icon: AlertTriangle,
      trend: 'neutral'
    },
    {
      label: 'Total Searches',
      value: '156',
      change: '+8%',
      icon: Search,
      trend: 'up'
    }
  ];

  const leadStats = [
    { label: 'Leads Added Today', value: '12', color: 'text-blue-400' },
    { label: 'Leads in Progress', value: '34', color: 'text-yellow-400' },
    { label: 'Leads Converted', value: '89', color: 'text-green-400' }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white mb-2">Dashboard Overview</h1>
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
              <div className="text-white">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
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
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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

      {/* Activity Section */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Recent Searches */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white mb-4">Recent Searches</h3>
          <div className="space-y-3">
            {recentSearches.map((search) => (
              <div key={search.id} className="flex items-center justify-between p-3 bg-black/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <div className="text-gray-300 text-sm">{search.query}</div>
                    <div className="text-xs text-gray-500">{search.resultsCount} results</div>
                  </div>
                </div>
                <div className="text-xs text-gray-500">{search.timestamp}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-white mb-4">Alerts & Notifications</h3>
          <div className="space-y-3">
            {alerts.map((alert) => {
              const iconMap = {
                warning: AlertTriangle,
                error: AlertTriangle,
                info: CheckCircle
              };
              const colorMap = {
                warning: 'text-yellow-400',
                error: 'text-red-400',
                info: 'text-blue-400'
              };
              const Icon = iconMap[alert.type];
              
              return (
                <div key={alert.id} className="flex items-start gap-3 p-3 bg-black/30 rounded-lg">
                  <div className={`w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[alert.type]}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-300 text-sm mb-1">{alert.title}</div>
                    <div className="text-xs text-gray-500 mb-1">{alert.description}</div>
                    <div className="text-xs text-gray-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {alert.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lead Tracking Snapshot */}
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-gray-400" />
          Lead Tracking Snapshot
        </h3>
        <div className="grid grid-cols-3 gap-6">
          {leadStats.map((stat, idx) => (
            <div key={idx} className="p-4 bg-black/30 rounded-lg">
              <div className="text-sm text-gray-400 mb-2">{stat.label}</div>
              <div className={`text-3xl ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
