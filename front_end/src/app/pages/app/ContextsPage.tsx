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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ctxName, setCtxName] = useState("");
  const [ctxDesc, setCtxDesc] = useState("");
  const [ctxCriteria, setCtxCriteria] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPrompt, setEditPrompt] = useState("");

  useEffect(() => {
    api.contexts()
      .then(c => setContexts(c || []))
      .catch((e) => { console.error(e); toast.error("Failed to load data. Please refresh.") })
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
          <p className="text-[#8a95a8] mt-1">Define reusable search criteria for AI relevance scoring</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                <Input placeholder="e.g., Food Industry Partners" value={ctxName} onChange={e => setCtxName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Brief description of this context" value={ctxDesc} onChange={e => setCtxDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>AI Criteria</Label>
                <Textarea placeholder="Describe what makes a business relevant..." className="min-h-[150px]" value={ctxCriteria} onChange={e => setCtxCriteria(e.target.value)} />
              </div>
              <Button className="w-full" onClick={async () => {
                try {
                  if (!ctxName) { toast.error("Enter a context name"); return; }
                  await api.createContext({
                    name: ctxName,
                    description: ctxDesc,
                    prompt_text: ctxCriteria,
                  });
                  const updated = await api.contexts();
                  setContexts(updated || []);
                  toast.success("Context created");
                  setDialogOpen(false);
                  setCtxName("");
                  setCtxDesc("");
                  setCtxCriteria("");
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
              <p className="text-sm text-[#8a95a8]">{context.description}</p>
              <div className="p-3 bg-[#151a22] rounded-lg">
                <div className="text-sm font-medium mb-2">AI Criteria:</div>
                <div className="text-sm text-gray-700 whitespace-pre-line">{context.criteria}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditingContext(context);
                  setEditName(context.name);
                  setEditPrompt(context.criteria);
                  setEditDialogOpen(true);
                }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={async () => {
                  try {
                    await api.deleteContext(Number(context.id));
                    const updated = await api.contexts();
                    setContexts(updated || []);
                    toast.success("Context deleted");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to delete context");
                  }
                }}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Search Context</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Context Name</Label>
              <Input placeholder="e.g., Food Industry Partners" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>AI Criteria</Label>
              <Textarea placeholder="Describe what makes a business relevant..." className="min-h-[150px]" value={editPrompt} onChange={e => setEditPrompt(e.target.value)} />
            </div>
            <Button className="w-full" onClick={async () => {
              try {
                if (!editName) { toast.error("Enter a context name"); return; }
                await api.updateContext(Number(editingContext.id), { name: editName, prompt_text: editPrompt });
                const updated = await api.contexts();
                setContexts(updated || []);
                setEditDialogOpen(false);
                toast.success("Context updated");
              } catch (err: any) {
                toast.error(err.message || "Failed to update context");
              }
            }}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
