import { useState, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { FileText, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";

export default function ContextsPage() {
  const [contexts, setContexts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.contexts()
      .then(c => setContexts(c || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const displayContexts = contexts.map((c: any) => ({
    id: String(c.context_id || c.id),
    name: c.name || c.context_name || "Context",
    description: c.description || c.prompt_text?.slice(0, 80) || "",
    criteria: c.criteria || c.prompt_text || "",
    usageCount: c.usage_count || 0,
  }));

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
                <Input id="ctx-name" placeholder="e.g., Food Industry Partners" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input id="ctx-desc" placeholder="Brief description of this context" />
              </div>
              <div className="space-y-2">
                <Label>AI Criteria</Label>
                <Textarea id="ctx-criteria" placeholder="Describe what makes a business relevant..." className="min-h-[150px]" />
              </div>
              <Button className="w-full" onClick={async () => {
                try {
                  const nameEl = document.getElementById("ctx-name") as HTMLInputElement;
                  const descEl = document.getElementById("ctx-desc") as HTMLInputElement;
                  const criteriaEl = document.getElementById("ctx-criteria") as HTMLTextAreaElement;
                  if (!nameEl?.value) { toast.error("Enter a context name"); return; }
                  await api.createContext({
                    name: nameEl.value,
                    description: descEl?.value || "",
                    prompt_text: criteriaEl?.value || "",
                  });
                  const updated = await api.contexts();
                  setContexts(updated || []);
                  toast.success("Context created");
                } catch (err: any) {
                  toast.error(err.message || "Failed to create context");
                }
              }}>
                Create Context
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {displayContexts.map((context) => (
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
