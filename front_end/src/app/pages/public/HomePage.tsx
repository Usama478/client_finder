import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { 
  Search, Target, ShieldCheck, Users, Mail, TrendingUp,
  CheckCircle2, ArrowRight, Zap, Database, Brain, Globe
} from "lucide-react";

export default function HomePage() {
  const features = [
    {
      icon: Globe,
      title: "Global Business Search",
      description: "Search and discover businesses worldwide with real-time data collection and smart filtering."
    },
    {
      icon: Brain,
      title: "AI Relevance Scoring",
      description: "Custom natural-language contexts help AI evaluate which businesses truly match your needs."
    },
    {
      icon: ShieldCheck,
      title: "Live Verification",
      description: "Real-time trust checks verify website credibility, legal presence, and contact authenticity."
    },
    {
      icon: Database,
      title: "Client Management",
      description: "Save and organize verified leads into a searchable, exportable client database."
    },
    {
      icon: Mail,
      title: "Smart Outreach",
      description: "AI-generated personalized emails with built-in analytics for opens, clicks, and replies."
    },
    {
      icon: TrendingUp,
      title: "Pipeline Analytics",
      description: "Track your entire workflow from discovery to outreach with detailed performance metrics."
    }
  ];

  const steps = [
    { number: "01", title: "Search", description: "Define your ideal client using keywords, location, and custom search contexts" },
    { number: "02", title: "Relevancy", description: "AI evaluates each business against your criteria with transparent scoring" },
    { number: "03", title: "Verification", description: "Trust scanner checks website credibility, legal status, and contact validity" },
    { number: "04", title: "Clients", description: "Save verified businesses to your managed client database" },
    { number: "05", title: "Outreach", description: "Generate personalized emails and track engagement analytics" },
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for freelancers and solo exporters",
      features: [
        "100 searches/month",
        "500 relevancy checks",
        "100 verifications",
        "50 email sends",
        "Basic analytics"
      ]
    },
    {
      name: "Professional",
      price: "$149",
      period: "/month",
      description: "For growing teams and agencies",
      features: [
        "Unlimited searches",
        "2,000 relevancy checks",
        "500 verifications",
        "300 email sends",
        "Advanced analytics",
        "Priority support"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations with specific needs",
      features: [
        "Unlimited everything",
        "Custom AI thresholds",
        "Dedicated support",
        "API access",
        "Custom integrations"
      ]
    }
  ];

  return (
    <div className="bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4">AI-Powered Client Discovery</Badge>
              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                Find, Verify, and Contact Your Ideal Clients
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Stop wasting time on manual prospecting. Client Finder combines real-time business search, 
                AI relevance scoring, and trust verification into one powerful workflow.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth/signup">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/features">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto">
                    See How It Works
                  </Button>
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  14-day free trial
                </div>
              </div>
            </div>
            <div className="lg:pl-12">
              <Card className="shadow-2xl">
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b">
                      <span className="font-semibold">Search Results</span>
                      <Badge variant="secondary">Live</Badge>
                    </div>
                    {[
                      { name: "TechCorp Industries", score: 94, status: "Verified", color: "text-emerald-500" },
                      { name: "Global Exports Ltd", score: 88, status: "Verified", color: "text-emerald-500" },
                      { name: "Innovation Partners", score: 76, status: "Pending", color: "text-amber-500" }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium text-sm text-foreground">{item.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="text-xs text-muted-foreground">Match Score: {item.score}%</div>
                            <Badge variant="outline" className={`text-xs ${item.color} border-current`}>
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                        <ShieldCheck className={`h-5 w-5 ${item.color}`} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="border-y border-border bg-muted py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6 text-sm text-muted-foreground">Trusted by exporters and B2B teams worldwide</div>
          <div className="flex justify-center items-center gap-12 opacity-60">
            {["Company A", "Company B", "Company C", "Company D"].map((company, i) => (
              <div key={i} className="font-semibold text-muted-foreground">{company}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything you need in one platform</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Replace fragmented tools with a single, integrated workflow that takes you from search to signed client.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card key={i} className="border bg-card hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 text-foreground">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-muted border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4 text-foreground">Your complete client discovery pipeline</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A guided, step-by-step workflow that ensures you only contact qualified, verified prospects.
            </p>
          </div>
          <div className="space-y-6">
            {steps.map((step, i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="flex-shrink-0">
                      <div className="h-16 w-16 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-xl">
                        {step.number}
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-xl mb-2 text-foreground">{step.title}</h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                    {i < steps.length - 1 && (
                      <ArrowRight className="h-6 w-6 text-muted-foreground hidden lg:block" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground">Choose the plan that fits your business needs</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <Card key={i} className={`relative ${plan.popular ? 'border-blue-600 border-2 shadow-lg' : ''}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600">Most Popular</Badge>
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="font-semibold text-xl mb-2 text-foreground">{plan.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth/signup">
                    <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-primary to-blue-700 text-primary-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold mb-6">
            Ready to transform your client discovery?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join hundreds of exporters and B2B teams who've replaced manual prospecting with intelligent automation.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/signup">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto bg-transparent text-white border-white hover:bg-white/10">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
