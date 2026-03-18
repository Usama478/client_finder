import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Key, RefreshCw, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ApiKeyManagementPage() {
  const [showKeys, setShowKeys] = useState<{[key: string]: boolean}>({});

  const apiKeys = [
    { id: "1", service: "Google Maps API", key: "AIzaSyC...xyz123", status: "active", lastChecked: "2 hours ago" },
    { id: "2", service: "OpenAI API", key: "sk-proj...abc456", status: "active", lastChecked: "1 hour ago" },
    { id: "3", service: "Email Service", key: "key_live...def789", status: "active", lastChecked: "30 mins ago" }
  ];

  const toggleKeyVisibility = (id: string) => {
    setShowKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Key Management</h1>
        <p className="text-gray-600 mt-1">Manage external service API keys</p>
      </div>

      <div className="grid gap-4">
        {apiKeys.map((api) => (
          <Card key={api.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">{api.service}</CardTitle>
                </div>
                <Badge className="bg-green-600">Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <code className="flex-1 p-3 bg-gray-100 rounded font-mono text-sm">
                  {showKeys[api.id] ? api.key : "••••••••••••••••"}
                </code>
                <Button variant="outline" size="icon" onClick={() => toggleKeyVisibility(api.id)}>
                  {showKeys[api.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="icon" onClick={() => toast.success("Key rotated")}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-sm text-gray-600">Last checked: {api.lastChecked}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
