import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Users, Search, Mail, Activity, AlertCircle, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function AdminDashboardPage() {
  const metrics = [
    { label: "Active Users", value: "24", icon: Users, color: "text-blue-600" },
    { label: "Searches Today", value: "156", icon: Search, color: "text-purple-600" },
    { label: "Emails Today", value: "89", icon: Mail, color: "text-green-600" },
    { label: "System Health", value: "Good", icon: CheckCircle, color: "text-emerald-600" }
  ];

  const usageData = [
    { day: "Mon", searches: 120, emails: 45 },
    { day: "Tue", searches: 150, emails: 67 },
    { day: "Wed", searches: 98, emails: 34 },
    { day: "Thu", searches: 156, emails: 89 },
    { day: "Fri", searches: 142, emails: 76 }
  ];

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
            {[
              { service: "Search Engine", status: "operational", uptime: "99.9%" },
              { service: "AI Service", status: "operational", uptime: "99.8%" },
              { service: "Verification Service", status: "operational", uptime: "99.7%" },
              { service: "Email Service", status: "operational", uptime: "99.9%" }
            ].map((service, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="font-medium">{service.service}</div>
                    <div className="text-sm text-gray-600">Uptime: {service.uptime}</div>
                  </div>
                </div>
                <Badge className="bg-green-600">Operational</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
