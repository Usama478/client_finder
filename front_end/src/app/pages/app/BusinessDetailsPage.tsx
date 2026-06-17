import { useParams, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Separator } from "../../components/ui/separator";
import { 
  ArrowLeft, ExternalLink, MapPin, Mail, Phone, Globe,
  Target, ShieldCheck, CheckCircle, AlertCircle, XCircle,
  Save, Send, RefreshCw, Building, Calendar, Activity, Linkedin, Package, Brain
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";

export default function BusinessDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporterProfileId, setExporterProfileId] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hunterEmails, setHunterEmails] = useState<any[]>([]);
  const [primaryContactEmail, setPrimaryContactEmail] = useState<string | null>(null);
  const [hunterLoading, setHunterLoading] = useState(false);
  const [reVerifying, setReVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const formatUrl = (url: string | null | undefined) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `https://${url}`;
  };

  const displayRelevanceScore = business
    ? Math.round(business.relevance_score || 0)
    : 0;

  useEffect(() => {
    if (!id) return;
    api.leadDetail(Number(id))
      .then(data => {
        setBusiness(data);
        setHunterEmails(data.hunter_emails || []);
        setPrimaryContactEmail(data.primary_contact_email || null);
      })
      .catch((err: any) => setError(err.message || "Failed to load business details"))
      .finally(() => setLoading(false));
      
    api.getMyProfile().then(p => setExporterProfileId(p.id)).catch(() => {});
  }, [id]);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="flex flex-col h-[50vh] items-center justify-center p-6 text-center">
      <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
      <h2 className="text-xl font-bold mb-2 text-foreground">Error Loading Business</h2>
      <p className="text-muted-foreground mb-6">{error}</p>
      <Button onClick={() => navigate(-1)} variant="outline">
        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
      </Button>
    </div>
  );
  if (!business) return null;

  const handleSaveClient = async () => {
    setSaving(true);
    try {
      await api.updateClientStatus(Number(id), true);
      toast.success("Saved to clients");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleReVerify = async () => {
    setReVerifying(true);
    const toastId = toast.loading("Re-running verification...");
    try {
      await api.verifyBusiness(Number(id));
      const updated = await api.leadDetail(Number(id));
      setBusiness(updated);
      toast.success("Verification updated", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Verification failed", { id: toastId });
    } finally {
      setReVerifying(false);
    }
  };

  const handleFindEmail = async () => {
    setHunterLoading(true);
    try {
      const result = await api.findEmail(Number(id));
      setHunterEmails(result.emails || []);
      if (result.primary_contact_email) setPrimaryContactEmail(result.primary_contact_email);
      if (result.cached) {
        toast.info("Showing cached email results");
      } else {
        toast.success(result.message || "Email lookup complete");
      }
    } catch (err: any) {
      toast.error(err.message || "Email lookup failed");
    } finally {
      setHunterLoading(false);
    }
  };

  const renderRelevanceBadge = (decision: string | null | undefined) => {
    if (decision === "relevant") return <Badge className="bg-green-600">Passed</Badge>;
    if (decision === "irrelevant") return <Badge className="bg-red-600">Failed</Badge>;
    if (decision === "low_confidence" || decision === "unknown") return <Badge className="bg-amber-600">Low Confidence</Badge>;
    return <Badge variant="outline">Pending</Badge>;
  };

  const renderVerificationBadge = (result: string | null | undefined, status: string | null | undefined) => {
    if (result === "verified") return <Badge className="bg-green-600">Verified</Badge>;
    if (result === "partial") return <Badge className="bg-amber-600">Partial</Badge>;
    if (result === "manual_review") return <Badge className="bg-amber-600">Manual Review</Badge>;
    if (!result && status === "failed") return <Badge className="bg-red-600">Failed</Badge>;
    return <Badge variant="outline">—</Badge>;
  };

  const handleGenerateEmail = async () => {
    if (!user) {
      toast.error("User session not found");
      return;
    }
    if (!exporterProfileId) {
      toast.error("Set up your exporter profile in Settings first");
      return;
    }
    setIsGenerating(true);
    try {
      await api.generateEmail(Number(id), user.user_id, exporterProfileId);
      navigate(`/app/email?clientIds=${id}`);
      toast.success("Email draft generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate email");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>{business.business_name}</h1>
            <Badge variant="outline">{business.business_type}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {business.address}
            </span>
            {business.website && (
              <a href={formatUrl(business.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
                <ExternalLink className="h-4 w-4" />
                {business.website}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReVerify} disabled={reVerifying}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-verify
          </Button>
          <Button variant="outline" onClick={handleSaveClient} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save to Clients
          </Button>
          <Button onClick={handleGenerateEmail} disabled={isGenerating}>
            <Send className="mr-2 h-4 w-4" />
            {isGenerating ? "Generating..." : "Generate Email"}
          </Button>
        </div>
      </div>

      {/* Score Summary Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-purple-200 bg-muted">
          <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                <span className="font-semibold">AI Relevance Score</span>
              </div>
              {renderRelevanceBadge(business.relevance_decision)}
            </div>
            <div className="flex items-center gap-4 mb-2">
              <Progress value={displayRelevanceScore} className="flex-1" />
              <span className="text-3xl font-bold text-purple-600">{displayRelevanceScore}%</span>
            </div>
            <div className="text-sm text-muted-foreground">Confidence: {business.confidence ? `${Math.round(business.confidence * 100)}%` : "—"}</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-muted">
          <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Verification Score</span>
              </div>
              {renderVerificationBadge(business.verification_result, business.verification_status)}
            </div>
            <div className="flex items-center gap-4 mb-2">
              <Progress value={business.verification_score || 0} className="flex-1" />
              <span className="text-3xl font-bold text-green-600">{business.verification_score || 0}%</span>
            </div>
            <div className="text-sm text-muted-foreground">Trust Level: {business.verification_score >= 70 ? "High Trust" : "Moderate"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="relevance">AI Relevance</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="intelligence">Intelligence</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="outreach">Outreach</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Business Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{business.email_context?.company_description || "No description available"}</p>
              </div>

              <Separator />

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Business Details
                  </h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Category</dt>
                      <dd className="font-medium">{business.business_type}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Location</dt>
                      <dd className="font-medium">{business.address}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Website Status</dt>
                      <dd>
                        <Badge className="bg-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {business.verification_artifacts?.accessibility?.website_live ? "Active" : "Unknown"}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contact Information
                  </h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">Email</dt>
                      <dd className="font-medium">{business.email_found}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Phone</dt>
                      <dd className="font-medium">{business.phone_number}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">Website</dt>
                      <dd>
                        {business.website ? (
                          <a href={formatUrl(business.website)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                            {business.website}
                          </a>
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relevance">
          <Card>
            <CardHeader>
              <CardTitle>AI Relevance Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted rounded-lg border border-[var(--border)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">Score: {displayRelevanceScore}%</span>
                  {renderRelevanceBadge(business.relevance_decision)}
                </div>
                <Progress value={displayRelevanceScore} className="mb-2" />
                <div className="text-sm text-muted-foreground">
                  Context Used: <span className="font-medium">{business.context_name || "No context recorded"}</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">AI Reasoning</h3>
                <div className="prose prose-sm max-w-none">
                  {(() => {
                    if (!business.relevance_reason) return null;
                    
                    try {
                      const parsed = JSON.parse(business.relevance_reason);
                      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                        return Object.entries(parsed).map(([key, value]) => (
                          <div key={key} className="mb-3">
                            <p className="font-bold">{key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</p>
                            <p className="text-muted-foreground">{String(value)}</p>
                          </div>
                        ));
                      }
                    } catch {
                      // Fall through to default rendering
                    }
                    
                    return <p className="whitespace-pre-line text-muted-foreground">{business.relevance_reason}</p>;
                  })()}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Match Factors</h3>
                <div className="space-y-2">
                  {(business.match_reasons || []).length === 0 && (business.mismatch_reasons || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No factors recorded.</p>
                  ) : (
                    <>
                      {(business.match_reasons || []).map((r: string, i: number) => (
                        <div key={`match-${i}`} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                      {(business.mismatch_reasons || []).map((r: string, i: number) => (
                        <div key={`mismatch-${i}`} className="flex items-center gap-2 text-sm">
                          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <CardTitle>Verification Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted rounded-lg border border-[var(--border)]">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    Trust Score: {business.verification_score || 0}%
                  </span>
                  {renderVerificationBadge(business.verification_result, business.verification_status)}
                </div>
                <Progress value={business.verification_score || 0} className="mb-2" />
                <div className="text-sm text-muted-foreground">Trust Level: {business.verification_score >= 70 ? "High Trust" : "Moderate"}</div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Website Credibility</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Website Status</span>
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{business.verification_artifacts?.accessibility?.website_live ? "Active" : "Unknown"}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">SSL Certificate</span>
                      {business.verification_artifacts?.accessibility?.ssl_valid
                        ? <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Valid</Badge>
                        : <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Unknown</Badge>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Domain Age</span>
                      <span className="text-sm font-medium">{business.domain_age_years ? `${business.domain_age_years} years` : "Unknown"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Privacy Policy</span>
                      {business.has_policy_pages
                        ? <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Present</Badge>
                        : <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not found</Badge>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Terms of Service</span>
                      {business.has_policy_pages
                        ? <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Present</Badge>
                        : <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not found</Badge>}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Contact & Social</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Email Validation</span>
                      {business.email_found
                        ? <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                        : <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not found</Badge>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Phone Validation</span>
                      {business.phone_number
                        ? <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{business.phone_number}</Badge>
                        : <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not found</Badge>}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">LinkedIn Presence</span>
                      {!!business.linkedin_company_url ? (
                        <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Found</Badge>
                      ) : (
                        <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Not Found</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Business Registration</span>
                      <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Unknown</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {(!business.risk_flags || business.risk_flags.length === 0) && (
                <div className="p-4 bg-muted border border-[var(--border)] rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-green-900">No warnings or red flags</div>
                      <div className="text-sm text-green-700">This business passed all credibility and trust checks</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                Product Catalog
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {!business.verified_product_catalog || Object.keys(business.verified_product_catalog).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Product catalog not yet extracted.</p>
              ) : (
                <>
                  {Array.isArray(business.verified_product_catalog.product_categories) && business.verified_product_catalog.product_categories.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Product Categories</h3>
                      <div className="flex flex-wrap gap-2">
                        {business.verified_product_catalog.product_categories.map((cat: string, i: number) => (
                          <span
                            key={i}
                            style={{
                              background: 'var(--muted)',
                              border: '1px solid var(--border)',
                              color: 'var(--foreground)',
                              fontSize: '0.75rem',
                              borderRadius: '9999px',
                              padding: '2px 10px',
                            }}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Sells Wholesale</div>
                      <div className="font-semibold text-sm" style={{
                        color: business.verified_product_catalog.sells_wholesale ? '#22c55e' : 'var(--muted-foreground)'
                      }}>
                        {business.verified_product_catalog.sells_wholesale === true ? 'Yes' :
                         business.verified_product_catalog.sells_wholesale === false ? 'No' : '—'}
                      </div>
                    </div>

                    <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Customer Type</div>
                      <div className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                        {business.verified_product_catalog.primary_customer_type || '—'}
                      </div>
                    </div>

                    <div style={{ background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                      <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Catalog Confidence</div>
                      <div className="font-semibold text-sm" style={{
                        color: business.verified_product_catalog.confidence === 'high' ? '#22c55e' :
                               business.verified_product_catalog.confidence === 'medium' ? '#f59e0b' :
                               business.verified_product_catalog.confidence === 'low' ? '#ef4444' : 'var(--muted-foreground)'
                      }}>
                        {business.verified_product_catalog.confidence
                          ? business.verified_product_catalog.confidence.charAt(0).toUpperCase() + business.verified_product_catalog.confidence.slice(1)
                          : '—'}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intelligence">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                Company Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {(business.linkedin_url || business.serp_enrichment?.linkedin_url) && (
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>LinkedIn</h3>
                  <a
                    href={business.linkedin_url || business.serp_enrichment?.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'var(--muted)',
                      border: '1px solid var(--border)',
                      color: 'var(--foreground)',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '0.875rem',
                      textDecoration: 'none',
                    }}
                  >
                    <Linkedin className="h-4 w-4" style={{ color: '#0a66c2' }} />
                    View on LinkedIn
                  </a>
                </div>
              )}

              {(business.serp_enrichment?.company_summary || (Array.isArray(business.serp_enrichment?.company_snippets) && business.serp_enrichment.company_snippets.length > 0)) && (
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Company Insights</h3>
                  {business.serp_enrichment?.company_summary ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      {business.serp_enrichment.company_summary}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {business.serp_enrichment.company_snippets
                        .map((s: string) => s.replace(/\.\.\.Read more/gi, "").replace(/…\s*Read more/gi, "").replace(/\.\.\.$/, "").replace(/…$/, "").trim())
                        .filter((s: string) => s.length >= 40 && (s.match(/·/g) || []).length < 2)
                        .map((snippet: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            <span style={{ color: '#3b82f6', marginTop: '2px', flexShrink: 0 }}>•</span>
                            {snippet}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {(business.serp_enrichment?.product_summary || (Array.isArray(business.serp_enrichment?.product_snippets) && business.serp_enrichment.product_snippets.length > 0)) && (
                <div>
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Product Insights</h3>
                  {business.serp_enrichment?.product_summary ? (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                      {business.serp_enrichment.product_summary}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {business.serp_enrichment.product_snippets
                        .map((s: string) => s.replace(/\.\.\.Read more/gi, "").replace(/…\s*Read more/gi, "").replace(/\.\.\.$/, "").replace(/…$/, "").trim())
                        .filter((s: string) => s.length >= 40 && (s.match(/·/g) || []).length < 2)
                        .map((snippet: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                            <span style={{ color: '#8b5cf6', marginTop: '2px', flexShrink: 0 }}>•</span>
                            {snippet}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {!business.linkedin_url && !business.serp_enrichment?.linkedin_url &&
               !business.serp_enrichment?.company_summary &&
               !business.serp_enrichment?.product_summary &&
               (!Array.isArray(business.serp_enrichment?.company_snippets) || business.serp_enrichment.company_snippets.length === 0) &&
               (!Array.isArray(business.serp_enrichment?.product_snippets) || business.serp_enrichment.product_snippets.length === 0) && (
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No intelligence data available for this lead.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Email</span>
                  </div>
                  <div className="pl-8">
                    <div className="font-medium">{business.email_found}</div>
                    <Badge className="bg-green-600 mt-2"><CheckCircle className="h-3 w-3 mr-1" />{business.email_found ? "Verified" : "Not found"}</Badge>
                  </div>
                </div>

              {primaryContactEmail && (
                <div className="p-4 rounded-lg" style={{ background: 'var(--muted)', border: '1px solid #22c55e33' }}>
                  <div className="flex items-center gap-3 mb-1">
                    <CheckCircle className="h-4 w-4" style={{ color: '#22c55e' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Primary Contact Email</span>
                  </div>
                  <div className="pl-7 font-medium" style={{ color: 'var(--foreground)' }}>{primaryContactEmail}</div>
                  <div className="pl-7 mt-1">
                    <Badge className="bg-green-600 text-xs"><CheckCircle className="h-2 w-2 mr-1" />Highest confidence</Badge>
                  </div>
                </div>
              )}

                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">Verified Contacts (Hunter.io)</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleFindEmail}
                      disabled={hunterLoading}
                    >
                      {hunterLoading ? (
                        <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-3 w-3" />
                      )}
                      {hunterLoading ? "Looking up..." : "Find verified email (1 credit)"}
                    </Button>
                  </div>
                  <div className="pl-8 space-y-2">
                    {hunterEmails.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Click to search for verified contact emails</p>
                    ) : (
                      hunterEmails.map((e: any, i: number) => (
                        <div key={i} className="text-sm border rounded p-2 bg-background">
                          <div className="font-medium">{e.email}</div>
                          <div className="text-muted-foreground">
                            {[e.first_name, e.last_name].filter(Boolean).join(" ")}
                            {e.position ? ` — ${e.position}` : ""}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">Confidence: {e.confidence}%</Badge>
                            {e.verified && <Badge className="bg-green-600 text-xs"><CheckCircle className="h-2 w-2 mr-1" />Verified</Badge>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Phone</span>
                  </div>
                  <div className="pl-8">
                    <div className="font-medium">{business.phone_number || "Not found"}</div>
                    {business.phone_number
                      ? <Badge className="bg-green-600 mt-2"><CheckCircle className="h-3 w-3 mr-1" />Found</Badge>
                      : <Badge variant="outline" className="mt-2"><XCircle className="h-3 w-3 mr-1" />Not found</Badge>}
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="h-5 w-5 text-muted-foreground" />
                    <span className="font-semibold">Website</span>
                  </div>
                  <div className="pl-8">
                    {business.website ? (
                      <a href={formatUrl(business.website)} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:text-blue-700">
                        {business.website}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="outreach">
          <Card>
            <CardHeader>
              <CardTitle>Outreach Status</CardTitle>
            </CardHeader>
            <CardContent>
              {(business.email_drafts || []).length > 0 ? (
                <div className="space-y-4">
                  {business.email_drafts.map((draft: any, i: number) => (
                    <div key={i} className="p-4 bg-muted rounded-lg border">
                      <div className="font-medium mb-2">{draft.subject || "Email Draft"}</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-line">{draft.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No outreach yet</h3>
                  <p className="text-muted-foreground mb-6">Generate an AI-powered email to start your outreach</p>
                  <Button onClick={handleGenerateEmail}>
                    <Send className="mr-2 h-4 w-4" />
                    Generate Email Draft
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
