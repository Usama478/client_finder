import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Search, Target, ShieldCheck, Users, Mail, Download, Clock } from "lucide-react";

export default function ActivityPage() {
  const activities = [
    { type: "search", message: "New search completed: Export companies in UAE", time: "2 hours ago", icon: Search, user: "John Doe" },
    { type: "relevance", message: "AI relevance scoring completed for 124 leads", time: "3 hours ago", icon: Target, user: "System" },
    { type: "verification", message: "Verified 45 businesses successfully", time: "4 hours ago", icon: ShieldCheck, user: "System" },
    { type: "client", message: "Saved 12 clients to database", time: "5 hours ago", icon: Users, user: "John Doe" },
    { type: "email", message: "Email campaign sent to 23 recipients", time: "6 hours ago", icon: Mail, user: "John Doe" },
    { type: "export", message: "Exported 50 clients to CSV", time: "1 day ago", icon: Download, user: "John Doe" },
    { type: "search", message: "Search: Technology firms Germany completed", time: "1 day ago", icon: Search, user: "John Doe" }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Activity</h1>
        <p className="text-gray-600 mt-1">Complete timeline of your workspace actions</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {activities.map((activity, i) => {
              const Icon = activity.icon;
              return (
                <div key={i} className="flex items-start gap-4 pb-4 border-b last:border-0">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{activity.message}</p>
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {activity.time} • by {activity.user}
                        </p>
                      </div>
                      <Badge variant="outline">{activity.type}</Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
