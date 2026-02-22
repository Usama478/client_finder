import { TrendingUp, Users, Target, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const stats = [
  { label: 'Total Clients Saved', value: '248', icon: Users, trend: '+12%' },
  { label: 'New Businesses Today', value: '34', icon: TrendingUp, trend: '+5%' },
  { label: 'Relevancy Success Rate', value: '87%', icon: Target, trend: '+3%' },
  { label: 'Validation Success Rate', value: '92%', icon: CheckCircle, trend: '+1%' },
];

const searchData = [
  { date: 'Mon', searches: 24 },
  { date: 'Tue', searches: 32 },
  { date: 'Wed', searches: 28 },
  { date: 'Thu', searches: 45 },
  { date: 'Fri', searches: 38 },
  { date: 'Sat', searches: 19 },
  { date: 'Sun', searches: 22 },
];

const validationData = [
  { day: 'Mon', validated: 18, failed: 3 },
  { day: 'Tue', validated: 25, failed: 5 },
  { day: 'Wed', validated: 22, failed: 4 },
  { day: 'Thu', validated: 35, failed: 6 },
  { day: 'Fri', validated: 30, failed: 4 },
  { day: 'Sat', validated: 15, failed: 2 },
  { day: 'Sun', validated: 17, failed: 3 },
];

const riskData = [
  { name: 'Low Risk', value: 156, color: '#10b981' },
  { name: 'Medium Risk', value: 68, color: '#f59e0b' },
  { name: 'High Risk', value: 24, color: '#ef4444' },
];

const alerts = [
  { id: 1, type: 'warning', business: 'Tech Solutions Inc.', message: 'Website SSL certificate expired', time: '2h ago' },
  { id: 2, type: 'error', business: 'Digital Marketing Co.', message: 'Address mismatch detected', time: '4h ago' },
  { id: 3, type: 'warning', business: 'Creative Studios', message: 'No social media presence found', time: '6h ago' },
];

export function Dashboard() {
  return (
    <div className="p-8 bg-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-white text-3xl mb-2">Dashboard Overview</h1>
        <p className="text-zinc-400">Monitor your client verification activity</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-zinc-400 text-sm mb-2">{stat.label}</p>
                    <p className="text-white text-3xl">{stat.value}</p>
                    <p className="text-emerald-500 text-sm mt-2">{stat.trend} from last week</p>
                  </div>
                  <div className="bg-zinc-800 p-3 rounded-lg">
                    <Icon className="w-6 h-6 text-zinc-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Searches Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={searchData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" />
                <YAxis stroke="#71717a" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="searches" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Validation Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={validationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="day" stroke="#71717a" />
                <YAxis stroke="#71717a" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Bar dataKey="validated" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="failed" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Risk Level Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={riskData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white">Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 bg-zinc-800 rounded-lg">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${alert.type === 'error' ? 'text-red-500' : 'text-amber-500'}`} />
                  <div className="flex-1">
                    <p className="text-white text-sm">{alert.business}</p>
                    <p className="text-zinc-400 text-sm">{alert.message}</p>
                    <p className="text-zinc-500 text-xs mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
