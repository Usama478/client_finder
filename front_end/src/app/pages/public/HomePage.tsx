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

      {/* ── Hero ── */}
      <section
        className="relative min-h-screen flex items-center"
        style={{
          background: "#0a0c10",
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-30"
          style={{ background: "radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-30"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)" }}
        />

        <div className="relative w-full max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[55%_45%] gap-12 items-center">

            <div className="space-y-8">
              <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800 }}>
                <span
                  className="block text-[48px] lg:text-[72px] leading-none"
                  style={{ color: "#e8edf5" }}
                >
                  Turn any niche into
                </span>
                <span
                  className="block text-[48px] lg:text-[72px] leading-none"
                  style={{
                    background: "linear-gradient(to right, #60a5fa, #34d399)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  a pipeline of buyers.
                </span>
              </h1>

              <p style={{ fontFamily: "DM Sans, sans-serif", fontSize: 18, color: "#8a95a8", maxWidth: 480 }}>
                Describe the kind of buyer you want. Client Finder searches the web,
                scores every result with AI, and verifies the best ones —
                so your time goes to real prospects, not noise.
              </p>

              <div className="flex gap-4">
                <Link to="/auth/signup">
                  <button
                    style={{
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: 8,
                      padding: "12px 24px",
                      fontFamily: "DM Sans, sans-serif",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Start for free →
                  </button>
                </Link>
                <Link to="/features">
                  <button
                    style={{
                      background: "transparent",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 8,
                      padding: "12px 24px",
                      fontFamily: "DM Sans, sans-serif",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    See how it works
                  </button>
                </Link>
              </div>

              <div className="flex gap-4 text-sm" style={{ color: "#8a95a8" }}>
                <span>✓ No credit card</span>
                <span>·</span>
                <span>✓ 14-day trial</span>
                <span>·</span>
                <span>✓ Cancel anytime</span>
              </div>
            </div>

            <div style={{ transform: "rotate(2deg)" }}>
              <div
                style={{
                  background: "#0f1218",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 16,
                  boxShadow: "0 20px 60px rgba(59,130,246,0.15)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 16,
                  }}
                >
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: "rgba(239,68,68,0.6)" }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: "rgba(245,158,11,0.6)" }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: "rgba(34,197,94,0.6)" }} />
                  </div>
                  <div className="flex items-center gap-2" style={{ fontFamily: "DM Sans, sans-serif", fontSize: 12, color: "#8a95a8" }}>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Searching: ethical fashion boutiques UK
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { name: "Albaray London", score: "96%", status: "Verified", statusStyle: { background: "rgba(16,185,129,0.15)", color: "#10b981" } },
                    { name: "Selected Femme DK", score: "91%", status: "Verified", statusStyle: { background: "rgba(16,185,129,0.15)", color: "#10b981" } },
                    { name: "Thought Clothing UK", score: "78%", status: "Scoring...", statusStyle: { background: "rgba(245,158,11,0.15)", color: "#f59e0b" } },
                  ].map((item, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#151a22",
                        borderRadius: 8,
                        padding: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 14, color: "#e8edf5" }}>{item.name}</span>
                      <div className="flex gap-2">
                        <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>{item.score}</span>
                        <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, ...item.statusStyle }}>{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Positioning Banner ── */}
      <section className="border-y border-border py-12 bg-card">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-widest text-amber-400">Who this is built for</p>
          <p className="text-xl font-semibold text-foreground font-['Syne'] mt-2">
            Pakistani textile exporters who want to find fashion brands, boutiques, and retailers abroad — without spending weeks on Google.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            {["🇬🇧 UK buyers", "🇩🇪 European retailers", "🇦🇺 AU/NZ boutiques"].map((chip, i) => (
              <span
                key={i}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 rounded-full bg-amber-400" />
            <span className="text-xs uppercase tracking-widest text-amber-400 font-medium">What it does</span>
          </div>
          <h2 className="text-3xl font-bold font-['Syne'] text-foreground">Everything you need in one platform</h2>
          <p className="text-muted-foreground max-w-xl mt-2 mb-12">
            Replace fragmented tools with a single, integrated workflow that takes you from search to signed client.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="group p-6 rounded-xl border border-border bg-card hover:border-blue-500/40 hover:bg-card/80 transition-all duration-300 cursor-default"
                >
                  <div className="w-11 h-11 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/15 transition-colors">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2 font-['Syne']">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 bg-background border-t border-[rgba(255,255,255,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 rounded-full bg-amber-400" />
            <span className="text-xs uppercase tracking-widest text-amber-400 font-medium">How It Works</span>
          </div>
          <h2 className="text-3xl font-bold font-['Syne'] text-foreground">Your complete pipeline</h2>

          <div className="mt-16 max-w-2xl">
            {steps.map((step, i) => (
              <div key={i}>
                <div className="flex items-start gap-6">
                  <div className="w-16 h-16 rounded-full flex-shrink-0 flex items-center justify-center font-bold font-['Syne'] text-lg bg-card border-2 border-primary/40 text-primary">
                    {step.number}
                  </div>
                  <div className="flex-1 pt-3">
                    <h3 className="font-semibold text-foreground font-['Syne']">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="ml-8 w-px h-8 bg-[rgba(255,255,255,0.06)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1 h-6 rounded-full bg-amber-400" />
            <span className="text-xs uppercase tracking-widest text-amber-400 font-medium">Pricing</span>
          </div>
          <h2 className="text-3xl font-bold font-['Syne'] text-foreground mb-2">Simple, transparent pricing</h2>
          <p className="text-muted-foreground mb-12">Choose the plan that fits your business needs</p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className="rounded-xl p-6 flex flex-col"
                style={
                  plan.popular
                    ? {
                        border: "1px solid rgba(59,130,246,0.5)",
                        background: "#0a0f1a",
                        boxShadow: "0 0 40px rgba(59,130,246,0.1)",
                      }
                    : {
                        border: "1px solid rgba(255,255,255,0.07)",
                        background: "#0f1218",
                      }
                }
              >
                {plan.popular && (
                  <span className="inline-block mb-3 text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    Most popular
                  </span>
                )}
                <h3 className="font-semibold text-xl text-foreground font-['Syne']">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold font-['Syne'] text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth/signup">
                  {plan.popular ? (
                    <button className="w-full h-10 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium hover:from-blue-500 hover:to-blue-400 transition-all">
                      Get Started
                    </button>
                  ) : (
                    <Button variant="outline" className="w-full">Get Started</Button>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)" }}
            />
            <div className="relative rounded-2xl border border-border bg-card p-12 text-center">
              <h2 className="font-['Syne'] text-3xl font-bold text-foreground mb-4">
                Ready to find your first overseas buyer?
              </h2>
              <p className="text-muted-foreground mb-8">
                Set up takes 2 minutes. Describe the kind of business you want to reach, and the AI does the rest.
              </p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link to="/auth/signup">
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white border-0 h-12 px-8 text-base font-medium rounded-lg transition-all">
                    Start for free →
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button variant="outline" className="h-12 px-8 text-base rounded-lg">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
