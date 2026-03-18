import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { FileText, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function ContextsPage() {
  const [contexts, setContexts] = useState([
    {
      id: "1",
      name: "B2B Exporters",
      description: "Companies focused on B2B export with international presence",
      criteria: "Looking for businesses that:\n• Have B2B business model\n• Export products/services internationally\n• Have verified online presence\n• Show professional operations",
      usageCount: 24
    },
    {
      id: "2",
      name: "Tech Partners",
      description: "Technology solution providers and software companies",
      criteria: "Target tech companies that:\n• Develop software or tech solutions\n• Focus on enterprise/B2B\n• Have proven product portfolio",
      usageCount: 12
    }
  ]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Search Contexts</h1>
          <p className="text-gray-600 mt-1">Define reusable search criteria for AI relevance scoring</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Context
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Search Context</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Context Name</Label>
                <Input placeholder="e.g., Food Industry Partners" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Brief description of this context" />
              </div>
              <div className="space-y-2">
                <Label>AI Criteria</Label>
                <Textarea placeholder="Describe what makes a business relevant..." className="min-h-[150px]" />
              </div>
              <Button className="w-full" onClick={() => toast.success("Context created")}>
                Create Context
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {contexts.map((context) => (
          <Card key={context.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <CardTitle>{context.name}</CardTitle>
                </div>
                <Badge variant="secondary">{context.usageCount} uses</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{context.description}</p>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium mb-2">AI Criteria:</div>
                <div className="text-sm text-gray-700 whitespace-pre-line">{context.criteria}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
