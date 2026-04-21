import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Users, Search, Mail, Activity, AlertCircle, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../../../lib/api";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState([
    { label: "Active Users", value: "...", icon: Users, color: "text-blue-600" },
    { label: "Searches Today", value: "...", icon: Search, color: "text-purple-600" },
    { label: "Emails Today", value: "...", icon: Mail, color: "text-green-600" },
    { label: "System Health", value: "...", icon: CheckCircle, color: "text-emerald-600" }
  ]);

  const [usageData, setUsageData] = useState([
    { day: "Mon", searches: 0, emails: 0 },
    { day: "Tue", searches: 0, emails: 0 },
    { day: "Wed", searches: 0, emails: 0 },
    { day: "Thu", searches: 0, emails: 0 },
    { day: "Fri", searches: 0, emails: 0 }
  ]);

  const [systemStatus, setSystemStatus] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [users, health] = await Promise.all([
          api.adminUsers(),
          api.adminHealth()
        ]);

        const activeUsers = users.filter((u: any) => u.is_active).length;
        
        setMetrics([
          { label: "Active Users", value: String(activeUsers), icon: Users, color: "text-blue-600" },
          { label: "Searches Today", value: String(health.searches_today || 0), icon: Search, color: "text-purple-600" },
          { label: "Emails Today", value: String(health.emails_today || 0), icon: Mail, color: "text-green-600" },
          { label: "System Health", value: health.status || "Good", icon: CheckCircle, color: "text-emerald-600" }
        ]);

        if (health.usage_data) {
          setUsageData(health.usage_data);
        }

        if (health.services) {
          setSystemStatus(health.services);
        }
      } catch (error) {
        console.error("Failed to fetch admin data:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Platform monitoring and administration</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
                    <p className="text-2xl font-bold">{metric.value}</p>
                  </div>
                  <div className={`p-2 rounded-lg bg-gray-50 ${metric.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Platform Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={usageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="searches" fill="#3b82f6" name="Searches" />
              <Bar dataKey="emails" fill="#10b981" name="Emails" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {systemStatus.length > 0 ? systemStatus.map((service, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  {service.status === "operational" ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <div className="font-medium">{service.service}</div>
                    <div className="text-sm text-gray-600">Uptime: {service.uptime}</div>
                  </div>
                </div>
                <Badge className={service.status === "operational" ? "bg-green-600" : "bg-red-600"}>
                  {service.status === "operational" ? "Operational" : "Down"}
                </Badge>
              </div>
            )) : (
              <div className="text-center text-gray-500 py-4">Loading system status...</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
