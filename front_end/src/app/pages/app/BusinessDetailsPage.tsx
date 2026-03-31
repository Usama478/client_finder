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
  Save, Send, RefreshCw, Building, Calendar, Activity
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

  useEffect(() => {
    if (!id) return;
    api.leadDetail(Number(id))
      .then(data => setBusiness(data))
      .catch(() => navigate(-1))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!business) return null;

  const handleSaveClient = async () => {
    try {
      await api.updateClientStatus(Number(id), true);
      toast.success("Saved to clients");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  const handleReVerify = async () => {
    toast.loading("Re-running verification...");
    try {
      await api.verifyBusiness(Number(id));
      const updated = await api.leadDetail(Number(id));
      setBusiness(updated);
      toast.success("Verification updated");
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    }
  };

  const handleGenerateEmail = async () => {
    if (!user) return;
    try {
      await api.generateEmail(Number(id), user.user_id);
      navigate("/app/email");
      toast.success("Email draft generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate email");
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
            <h1 className="text-3xl font-bold">{business.business_name}</h1>
            <Badge variant="outline">{business.business_type}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-gray-600">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {business.address}
            </span>
            <a href={`https://${business.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:text-blue-700">
              <ExternalLink className="h-4 w-4" />
              {business.website}
            </a>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReVerify}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Re-verify
          </Button>
          <Button variant="outline" onClick={handleSaveClient}>
            <Save className="mr-2 h-4 w-4" />
            Save to Clients
          </Button>
          <Button onClick={handleGenerateEmail}>
            <Send className="mr-2 h-4 w-4" />
            Generate Email
          </Button>
        </div>
      </div>

      {/* Score Summary Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                <span className="font-semibold">AI Relevance Score</span>
              </div>
              <Badge className="bg-green-600">{business.relevance_decision === "relevant" ? "Passed" : "Failed"}</Badge>
            </div>
            <div className="flex items-center gap-4 mb-2">
              <Progress value={Math.round(business.relevance_score || 0)} className="flex-1" />
              <span className="text-3xl font-bold text-purple-600">{Math.round(business.relevance_score || 0)}%</span>
            </div>
            <div className="text-sm text-gray-600">Confidence: {business.confidence ? `${Math.round(business.confidence * 100)}%` : "—"}</div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Verification Score</span>
              </div>
              <Badge className="bg-green-600">{business.verification_result || "pending"}</Badge>
            </div>
            <div className="flex items-center gap-4 mb-2">
              <Progress value={business.verification_score || 0} className="flex-1" />
              <span className="text-3xl font-bold text-green-600">{business.verification_score || 0}%</span>
            </div>
            <div className="text-sm text-gray-600">Trust Level: {business.verification_score >= 70 ? "High Trust" : "Moderate"}</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="relevance">AI Relevance</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
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
                <p className="text-gray-700">{business.email_context?.company_description || "No description available"}</p>
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
                      <dt className="text-sm text-gray-600">Category</dt>
                      <dd className="font-medium">{business.business_type}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">Location</dt>
                      <dd className="font-medium">{business.address}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">Website Status</dt>
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
                      <dt className="text-sm text-gray-600">Email</dt>
                      <dd className="font-medium">{business.email_found}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">Phone</dt>
                      <dd className="font-medium">{business.phone_number}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-600">Website</dt>
                      <dd>
                        <a href={`https://${business.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                          {business.website}
                        </a>
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
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold">Score: {Math.round(business.relevance_score || 0)}%</span>
                  <Badge className="bg-green-600">{business.relevance_decision === "relevant" ? "Passed" : "Failed"}</Badge>
                </div>
                <Progress value={Math.round(business.relevance_score || 0)} className="mb-2" />
                <div className="text-sm text-gray-600">
                  Context: <span className="font-medium">B2B Export</span>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">AI Reasoning</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-line text-gray-700">{business.relevance_reason || ""}</p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Match Factors</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Business model alignment: Excellent</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Geographic focus: Strong match</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Product/service alignment: High relevance</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Company maturity: Appropriate</span>
                  </div>
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
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    Trust Score: {business.verification_score || 0}%
                  </span>
                  <Badge className="bg-green-600">{business.verification_result || "pending"}</Badge>
                </div>
                <Progress value={business.verification_score || 0} className="mb-2" />
                <div className="text-sm text-gray-600">Trust Level: {business.verification_score >= 70 ? "High Trust" : "Moderate"}</div>
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
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{business.verification_artifacts?.accessibility?.ssl_valid ? "Valid" : "Unknown"}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Domain Age</span>
                      <span className="text-sm font-medium">{business.domain_age_years ? `${business.domain_age_years} years` : "Unknown"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Privacy Policy</span>
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{business.has_policy_pages ? "Present" : "Not found"}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Terms of Service</span>
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{business.has_policy_pages ? "Present" : "Not found"}</Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Contact & Social</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Email Validation</span>
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />{business.email_found ? "Verified" : "Not found"}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Phone Validation</span>
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
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
                      <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {(!business.risk_flags || business.risk_flags.length === 0) && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
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

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contact Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="h-5 w-5 text-gray-600" />
                    <span className="font-semibold">Email</span>
                  </div>
                  <div className="pl-8">
                    <div className="font-medium">{business.email_found}</div>
                    <Badge className="bg-green-600 mt-2"><CheckCircle className="h-3 w-3 mr-1" />{business.email_found ? "Verified" : "Not found"}</Badge>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Phone className="h-5 w-5 text-gray-600" />
                    <span className="font-semibold">Phone</span>
                  </div>
                  <div className="pl-8">
                    <div className="font-medium">{business.phone_number}</div>
                    <Badge className="bg-green-600 mt-2"><CheckCircle className="h-3 w-3 mr-1" />Verified</Badge>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Globe className="h-5 w-5 text-gray-600" />
                    <span className="font-semibold">Website</span>
                  </div>
                  <div className="pl-8">
                    <a href={`https://${business.website}`} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:text-blue-700">
                      {business.website}
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(business.activities || []).map((activity: any, i: number) => (
                  <div key={i} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <div className="bg-blue-50 p-2 rounded-lg">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{activity.action}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        by {activity.user} • {new Date(activity.date).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
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
                    <div key={i} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="font-medium mb-2">{draft.subject || "Email Draft"}</div>
                      <div className="text-sm text-gray-700 whitespace-pre-line">{draft.body}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Mail className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">No outreach yet</h3>
                  <p className="text-gray-600 mb-6">Generate an AI-powered email to start your outreach</p>
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
