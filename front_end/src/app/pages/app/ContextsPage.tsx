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
  const [businessType, setBusinessType] = useState("Manufacturer and exporter of leather and outdoor apparel");
  const [products, setProducts] = useState("Leather jackets, hats, gloves, vests, leather leg bags");
  const [productCategories, setProductCategories] = useState("Leather Apparel, Outdoor Gear, Motorsports Apparel");
  const [countryOfOrigin, setCountryOfOrigin] = useState("Pakistan");
  const [exportMarkets, setExportMarkets] = useState("USA, UK, Germany, Australia");
  const [targetBuyerType, setTargetBuyerType] = useState("Wholesale importers, retail chains, online stores, distributors, startup brands");
  const [targetBusinessSize, setTargetBusinessSize] = useState("Small boutiques, mid-size retailers");
  const [targetCountries, setTargetCountries] = useState("United States, United Kingdom, Canada, Europe, UK");
  const [preferredNiches, setPreferredNiches] = useState("Fashion leather, motorsports apparel");
  const [excludeBusinessTypes, setExcludeBusinessTypes] = useState("Marketplaces like Amazon/eBay, dropshippers, agencies");
  const [excludeCountries, setExcludeCountries] = useState("");
  const [valueProposition, setValueProposition] = useState("ISO/CE certified, 10 years export experience, MOQ from 500 pcs");
  const [toneOfOutreach, setToneOfOutreach] = useState("Professional and direct");
  const [createCharCount, setCreateCharCount] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContext, setEditingContext] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editForm, setEditForm] = useState({
    businessType: "",
    products: "",
    productCategories: "",
    countryOfOrigin: "",
    exportMarkets: "",
    targetBuyerType: "",
    targetBusinessSize: "",
    targetCountries: "",
    preferredNiches: "",
    excludeBusinessTypes: "",
    excludeCountries: "",
    valueProposition: "",
    toneOfOutreach: "",
  });
  const [editCharCount, setEditCharCount] = useState(0);

  const parsePromptText = (text: string) => {
    const lines = text.split("\n");
    const getVal = (prefix: string) => {
      const line = lines.find(l => l.startsWith(prefix));
      return line ? line.replace(prefix, "").trim() : "";
    };
    return {
      businessType: getVal("Business Type: "),
      products: getVal("Products: "),
      productCategories: getVal("Product Categories: "),
      countryOfOrigin: getVal("Country of Origin: "),
      exportMarkets: getVal("Current Export Markets: "),
      targetBuyerType: getVal("Target Buyer Type: "),
      targetBusinessSize: getVal("Target Business Size: "),
      targetCountries: getVal("Target Countries: "),
      preferredNiches: getVal("Preferred Niches: "),
      excludeBusinessTypes: getVal("Exclude Business Types: "),
      excludeCountries: getVal("Exclude Countries: "),
      valueProposition: getVal("My Value Proposition: "),
      toneOfOutreach: getVal("Tone of Outreach: "),
    };
  };

  const buildEditPromptText = (form: typeof editForm) => {
    const lines = [];
    lines.push("EXPORTER PROFILE");
    if (form.businessType.trim()) lines.push(`Business Type: ${form.businessType.trim()}`);
    if (form.products.trim()) lines.push(`Products: ${form.products.trim()}`);
    if (form.productCategories.trim()) lines.push(`Product Categories: ${form.productCategories.trim()}`);
    if (form.countryOfOrigin.trim()) lines.push(`Country of Origin: ${form.countryOfOrigin.trim()}`);
    if (form.exportMarkets.trim()) lines.push(`Current Export Markets: ${form.exportMarkets.trim()}`);

    lines.push("");
    lines.push("WHAT I AM LOOKING FOR");
    if (form.targetBuyerType.trim()) lines.push(`Target Buyer Type: ${form.targetBuyerType.trim()}`);
    if (form.targetBusinessSize.trim()) lines.push(`Target Business Size: ${form.targetBusinessSize.trim()}`);
    if (form.targetCountries.trim()) lines.push(`Target Countries: ${form.targetCountries.trim()}`);
    if (form.preferredNiches.trim()) lines.push(`Preferred Niches: ${form.preferredNiches.trim()}`);

    lines.push("");
    lines.push("WHAT TO AVOID");
    if (form.excludeBusinessTypes.trim()) lines.push(`Exclude Business Types: ${form.excludeBusinessTypes.trim()}`);
    if (form.excludeCountries.trim()) lines.push(`Exclude Countries: ${form.excludeCountries.trim()}`);

    lines.push("");
    lines.push("OUTREACH CONTEXT");
    if (form.valueProposition.trim()) lines.push(`My Value Proposition: ${form.valueProposition.trim()}`);
    if (form.toneOfOutreach.trim()) lines.push(`Tone of Outreach: ${form.toneOfOutreach.trim()}`);

    return lines.join("\n");
  };

  useEffect(() => {
    setEditCharCount(buildEditPromptText(editForm).length);
  }, [editForm]);

  const buildPromptText = () => {
    const lines = [];
    lines.push("EXPORTER PROFILE");
    if (businessType.trim()) lines.push(`Business Type: ${businessType.trim()}`);
    if (products.trim()) lines.push(`Products: ${products.trim()}`);
    if (productCategories.trim()) lines.push(`Product Categories: ${productCategories.trim()}`);
    if (countryOfOrigin.trim()) lines.push(`Country of Origin: ${countryOfOrigin.trim()}`);
    if (exportMarkets.trim()) lines.push(`Current Export Markets: ${exportMarkets.trim()}`);

    lines.push("");
    lines.push("WHAT I AM LOOKING FOR");
    if (targetBuyerType.trim()) lines.push(`Target Buyer Type: ${targetBuyerType.trim()}`);
    if (targetBusinessSize.trim()) lines.push(`Target Business Size: ${targetBusinessSize.trim()}`);
    if (targetCountries.trim()) lines.push(`Target Countries: ${targetCountries.trim()}`);
    if (preferredNiches.trim()) lines.push(`Preferred Niches: ${preferredNiches.trim()}`);

    lines.push("");
    lines.push("WHAT TO AVOID");
    if (excludeBusinessTypes.trim()) lines.push(`Exclude Business Types: ${excludeBusinessTypes.trim()}`);
    if (excludeCountries.trim()) lines.push(`Exclude Countries: ${excludeCountries.trim()}`);

    lines.push("");
    lines.push("OUTREACH CONTEXT");
    if (valueProposition.trim()) lines.push(`My Value Proposition: ${valueProposition.trim()}`);
    if (toneOfOutreach.trim()) lines.push(`Tone of Outreach: ${toneOfOutreach.trim()}`);

    return lines.join("\n");
  };

  useEffect(() => {
    setCreateCharCount(buildPromptText().length);
  }, [
    businessType, products, productCategories, countryOfOrigin, exportMarkets,
    targetBuyerType, targetBusinessSize, targetCountries, preferredNiches,
    excludeBusinessTypes, excludeCountries, valueProposition, toneOfOutreach
  ]);

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
    description: c.description || "",
    criteria: c.criteria || c.prompt_text || "",
    usageCount: c.usage_count || 0,
  }));

  const resetCreateForm = () => {
    setCtxName("");
    setBusinessType("Manufacturer and exporter of leather and outdoor apparel");
    setProducts("Leather jackets, hats, gloves, vests, leather leg bags");
    setProductCategories("Leather Apparel, Outdoor Gear, Motorsports Apparel");
    setCountryOfOrigin("Pakistan");
    setExportMarkets("USA, UK, Germany, Australia");
    setTargetBuyerType("Wholesale importers, retail chains, online stores, distributors, startup brands");
    setTargetBusinessSize("Small boutiques, mid-size retailers");
    setTargetCountries("United States, United Kingdom, Canada, Europe, UK");
    setPreferredNiches("Fashion leather, motorsports apparel");
    setExcludeBusinessTypes("Marketplaces like Amazon/eBay, dropshippers, agencies");
    setExcludeCountries("");
    setValueProposition("ISO/CE certified, 10 years export experience, MOQ from 500 pcs");
    setToneOfOutreach("Professional and direct");
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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Search Context</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Context Name</Label>
                <Input placeholder="e.g., Food Industry Partners" value={ctxName} onChange={e => setCtxName(e.target.value)} />
              </div>
              <div className="max-h-[70vh] overflow-y-auto space-y-5 pr-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">EXPORTER PROFILE</p>
                <div className="space-y-1">
                  <Label>Business Type</Label>
                  <Input value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="e.g. Manufacturer and exporter of leather and outdoor apparel" />
                </div>
                <div className="space-y-1">
                  <Label>Products</Label>
                  <Input value={products} onChange={e => setProducts(e.target.value)} placeholder="e.g. Leather jackets, hats, gloves, vests, leather leg bags" />
                </div>
                <div className="space-y-1">
                  <Label>Product Categories</Label>
                  <Input value={productCategories} onChange={e => setProductCategories(e.target.value)} placeholder="e.g. Leather Apparel, Outdoor Gear, Motorsports Apparel" />
                </div>
                <div className="space-y-1">
                  <Label>Country of Origin</Label>
                  <Input value={countryOfOrigin} onChange={e => setCountryOfOrigin(e.target.value)} placeholder="e.g. Pakistan" />
                </div>
                <div className="space-y-1">
                  <Label>Current Export Markets</Label>
                  <Input value={exportMarkets} onChange={e => setExportMarkets(e.target.value)} placeholder="e.g. USA, UK, Germany, Australia" />
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">WHAT I AM LOOKING FOR</p>
                <div className="space-y-1">
                  <Label>Target Buyer Type</Label>
                  <Input value={targetBuyerType} onChange={e => setTargetBuyerType(e.target.value)} placeholder="e.g. Wholesale importers, retail chains, online stores" />
                </div>
                <div className="space-y-1">
                  <Label>Target Business Size</Label>
                  <Input value={targetBusinessSize} onChange={e => setTargetBusinessSize(e.target.value)} placeholder="e.g. Small boutiques, mid-size retailers" />
                </div>
                <div className="space-y-1">
                  <Label>Target Countries</Label>
                  <Input value={targetCountries} onChange={e => setTargetCountries(e.target.value)} placeholder="e.g. United States, United Kingdom, Canada" />
                </div>
                <div className="space-y-1">
                  <Label>Preferred Niches</Label>
                  <Input value={preferredNiches} onChange={e => setPreferredNiches(e.target.value)} placeholder="e.g. Fashion leather, motorsports apparel" />
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">WHAT TO AVOID</p>
                <div className="space-y-1">
                  <Label>Exclude Business Types</Label>
                  <Input value={excludeBusinessTypes} onChange={e => setExcludeBusinessTypes(e.target.value)} placeholder="e.g. Marketplaces like Amazon/eBay, dropshippers" />
                </div>
                <div className="space-y-1">
                  <Label>Exclude Countries</Label>
                  <Input value={excludeCountries} onChange={e => setExcludeCountries(e.target.value)} placeholder="e.g. India, China" />
                </div>

                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">OUTREACH CONTEXT</p>
                <div className="space-y-1">
                  <Label>My Value Proposition</Label>
                  <Input value={valueProposition} onChange={e => setValueProposition(e.target.value)} placeholder="e.g. ISO/CE certified, 10 years export experience" />
                </div>
                <div className="space-y-1">
                  <Label>Tone of Outreach</Label>
                  <Input value={toneOfOutreach} onChange={e => setToneOfOutreach(e.target.value)} placeholder="e.g. Professional and direct" />
                </div>
              </div>
              
              <div>
                <p className="text-xs text-muted-foreground pt-1">
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
                      description: "",
                      prompt_text: buildPromptText(),
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
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
                {context.description ? context.description : "Search context with custom criteria"}
              </p>
              <div className="flex gap-2 shrink-0 mt-auto">
                <Button variant="outline" size="sm" onClick={() => {
                  setEditingContext(context);
                  setEditName(context.name);
                  const criteria = context.criteria || "";
                  const parsed = parsePromptText(criteria);
                  setEditForm(parsed);
                  setEditCharCount(buildEditPromptText(parsed).length);
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
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Search Context</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Context Name</Label>
              <Input placeholder="e.g., Food Industry Partners" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="max-h-[70vh] overflow-y-auto space-y-5 pr-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">EXPORTER PROFILE</p>
              <div className="space-y-1">
                <Label>Business Type</Label>
                <Input value={editForm.businessType} onChange={e => setEditForm({ ...editForm, businessType: e.target.value })} placeholder="e.g. Manufacturer and exporter of leather and outdoor apparel" />
              </div>
              <div className="space-y-1">
                <Label>Products</Label>
                <Input value={editForm.products} onChange={e => setEditForm({ ...editForm, products: e.target.value })} placeholder="e.g. Leather jackets, hats, gloves, vests, leather leg bags" />
              </div>
              <div className="space-y-1">
                <Label>Product Categories</Label>
                <Input value={editForm.productCategories} onChange={e => setEditForm({ ...editForm, productCategories: e.target.value })} placeholder="e.g. Leather Apparel, Outdoor Gear, Motorsports Apparel" />
              </div>
              <div className="space-y-1">
                <Label>Country of Origin</Label>
                <Input value={editForm.countryOfOrigin} onChange={e => setEditForm({ ...editForm, countryOfOrigin: e.target.value })} placeholder="e.g. Pakistan" />
              </div>
              <div className="space-y-1">
                <Label>Current Export Markets</Label>
                <Input value={editForm.exportMarkets} onChange={e => setEditForm({ ...editForm, exportMarkets: e.target.value })} placeholder="e.g. USA, UK, Germany, Australia" />
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">WHAT I AM LOOKING FOR</p>
              <div className="space-y-1">
                <Label>Target Buyer Type</Label>
                <Input value={editForm.targetBuyerType} onChange={e => setEditForm({ ...editForm, targetBuyerType: e.target.value })} placeholder="e.g. Wholesale importers, retail chains, online stores" />
              </div>
              <div className="space-y-1">
                <Label>Target Business Size</Label>
                <Input value={editForm.targetBusinessSize} onChange={e => setEditForm({ ...editForm, targetBusinessSize: e.target.value })} placeholder="e.g. Small boutiques, mid-size retailers" />
              </div>
              <div className="space-y-1">
                <Label>Target Countries</Label>
                <Input value={editForm.targetCountries} onChange={e => setEditForm({ ...editForm, targetCountries: e.target.value })} placeholder="e.g. United States, United Kingdom, Canada" />
              </div>
              <div className="space-y-1">
                <Label>Preferred Niches</Label>
                <Input value={editForm.preferredNiches} onChange={e => setEditForm({ ...editForm, preferredNiches: e.target.value })} placeholder="e.g. Fashion leather, motorsports apparel" />
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">WHAT TO AVOID</p>
              <div className="space-y-1">
                <Label>Exclude Business Types</Label>
                <Input value={editForm.excludeBusinessTypes} onChange={e => setEditForm({ ...editForm, excludeBusinessTypes: e.target.value })} placeholder="e.g. Marketplaces like Amazon/eBay, dropshippers" />
              </div>
              <div className="space-y-1">
                <Label>Exclude Countries</Label>
                <Input value={editForm.excludeCountries} onChange={e => setEditForm({ ...editForm, excludeCountries: e.target.value })} placeholder="e.g. India, China" />
              </div>

              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">OUTREACH CONTEXT</p>
              <div className="space-y-1">
                <Label>My Value Proposition</Label>
                <Input value={editForm.valueProposition} onChange={e => setEditForm({ ...editForm, valueProposition: e.target.value })} placeholder="e.g. ISO/CE certified, 10 years export experience" />
              </div>
              <div className="space-y-1">
                <Label>Tone of Outreach</Label>
                <Input value={editForm.toneOfOutreach} onChange={e => setEditForm({ ...editForm, toneOfOutreach: e.target.value })} placeholder="e.g. Professional and direct" />
              </div>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground pt-1">
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
                  await api.updateContext(Number(editingContext.id), { name: editName, prompt_text: buildEditPromptText(editForm) });
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
