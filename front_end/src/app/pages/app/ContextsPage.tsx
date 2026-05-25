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

const MAX_CHARS = 5000;

export default function ContextsPage() {
  const [contexts, setContexts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ctxName, setCtxName] = useState("");
  const [ctxDesc, setCtxDesc] = useState("");
  const [ctxCriteria, setCtxCriteria] = useState("");
  const [createCharCount, setCreateCharCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editCharCount, setEditCharCount] = useState(0);

  const createOverLimit = createCharCount > MAX_CHARS;
  const editOverLimit = editCharCount > MAX_CHARS;

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

  const resetCreateForm = () => {
    setCtxName("");
    setCtxDesc("");
    setCtxCriteria("");
    setCreateCharCount(0);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Search Contexts</h1>
          <p className="text-muted-foreground mt-1">Define reusable search criteria for AI relevance scoring</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetCreateForm();
        }}>
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
                <Textarea
                  placeholder="Describe what makes a business relevant..."
                  className="min-h-[150px]"
                  value={ctxCriteria}
                  onChange={e => {
                    setCtxCriteria(e.target.value);
                    setCreateCharCount(e.target.value.length);
                  }}
                />
                <p className="text-sm text-muted-foreground">
                  {createCharCount} / {MAX_CHARS}
                </p>
                {createOverLimit && (
                  <p className="text-sm text-amber-600">
                    Character limit exceeded. Shorten your criteria to save.
                  </p>
                )}
              </div>
              <Button
                className="w-full"
                disabled={!ctxName.trim() || createOverLimit}
                onClick={async () => {
                  try {
                    if (!ctxName.trim()) { toast.error("Enter a context name"); return; }
                    if (createOverLimit) return;
                    await api.createContext({
                      name: ctxName,
                      description: ctxDesc,
                      prompt_text: ctxCriteria,
                    });
                    const updated = await api.contexts();
                    setContexts(updated || []);
                    toast.success("Context created");
                    setDialogOpen(false);
                    resetCreateForm();
                  } catch (err: any) {
                    toast.error(err.message || "Failed to create context");
                  }
                }}
              >
                Create Context
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayContexts.map((context) => (
          <Card key={context.id} className="h-[200px] flex flex-col overflow-hidden">
            <CardHeader className="pb-2 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                  <CardTitle className="text-base truncate">{context.name}</CardTitle>
                </div>
                <Badge variant="secondary" className="shrink-0">{context.usageCount} uses</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col flex-1 min-h-0 pt-0 space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3 flex-1 min-h-0">
                {context.criteria || "No criteria set"}
              </p>
              <div className="flex gap-2 shrink-0 mt-auto">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditingContext(context);
                  setEditName(context.name);
                  const criteria = context.criteria || "";
                  setEditPrompt(criteria);
                  setEditCharCount(criteria.length);
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
              <Textarea
                placeholder="Describe what makes a business relevant..."
                className="min-h-[150px]"
                value={editPrompt}
                onChange={e => {
                  setEditPrompt(e.target.value);
                  setEditCharCount(e.target.value.length);
                }}
              />
              <p className="text-sm text-muted-foreground">
                {editCharCount} / {MAX_CHARS}
              </p>
              {editOverLimit && (
                <p className="text-sm text-amber-600">
                  Character limit exceeded. Shorten your criteria to save.
                </p>
              )}
            </div>
            <Button
              className="w-full"
              disabled={!editName.trim() || editOverLimit}
              onClick={async () => {
                try {
                  if (!editName.trim()) { toast.error("Enter a context name"); return; }
                  if (editOverLimit) return;
                  await api.updateContext(Number(editingContext.id), { name: editName, prompt_text: editPrompt });
                  const updated = await api.contexts();
                  setContexts(updated || []);
                  setEditDialogOpen(false);
                  toast.success("Context updated");
                } catch (err: any) {
                  toast.error(err.message || "Failed to update context");
                }
              }}
            >
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
