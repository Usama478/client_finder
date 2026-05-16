import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import {
  Globe, Brain, ShieldCheck, Database, Mail, LineChart,
  Search, Target, CheckCircle, FileText, Users, Zap,
  ArrowRight
} from "lucide-react";

export default function FeaturesPage() {
  const mainFeatures = [
    {
      icon: Globe,
      title: "Global Business Search",
      description: "Search businesses worldwide with real-time data scraping",
      details: [
        "Multi-source data aggregation from web directories",
        "Advanced filtering by location, industry, and keywords",
        "Real-time data collection and cleaning",
        "Persistent search history for easy reload"
      ]
    },
    {
      icon: Brain,
      title: "AI Relevance Scoring",
      description: "Custom natural-language contexts guide intelligent matching",
      details: [
        "Define your ideal client in plain English",
        "AI evaluates each business against your criteria",
        "Transparent scoring with reasoning explanations",
        "Confidence levels for every match decision"
      ]
    },
    {
      icon: ShieldCheck,
      title: "Real-Time Verification",
      description: "Deep trust checks ensure contact authenticity",
      details: [
        "Website credibility analysis (SSL, domain age, content)",
        "Legal entity verification and business registration",
        "Contact validation for emails and phone numbers",
        "Social media presence and professional network checks"
      ]
    },
    {
      icon: Database,
      title: "Client Management",
      description: "Organized database of verified, qualified leads",
      details: [
        "Save shortlisted businesses to managed pipeline",
        "Filter and search your client database",
        "Export to CSV or integrate with CRM",
        "Track verification and relevance status"
      ]
    },
    {
      icon: Mail,
      title: "Email Workspace",
      description: "AI-assisted outreach with performance tracking",
      details: [
        "Auto-generate personalized emails using AI",
        "Custom templates with business context",
        "Approve and send directly from platform",
        "Track opens, clicks, bounces, and replies"
      ]
    },
    {
      icon: LineChart,
      title: "Pipeline Analytics",
      description: "Monitor performance from search to signed client",
      details: [
        "Multi-step funnel visualization",
        "Conversion tracking at each stage",
        "Email campaign performance metrics",
        "Activity timeline and audit log"
      ]
    }
  ];

  const workflow = [
    {
      step: 1,
      icon: Search,
      title: "Search",
      description: "Define search criteria and select custom context"
    },
    {
      step: 2,
      icon: Target,
      title: "Relevancy",
      description: "AI scores each business against your needs"
    },
    {
      step: 3,
      icon: ShieldCheck,
      title: "Verification",
      description: "Trust scanner validates credibility"
    },
    {
      step: 4,
      icon: CheckCircle,
      title: "Save Clients",
      description: "Add verified leads to your database"
    },
    {
      step: 5,
      icon: Mail,
      title: "Outreach",
      description: "Generate and send personalized emails"
    }
  ];

  const additionalFeatures = [
    { icon: FileText, title: "Search Contexts", description: "Create reusable search criteria templates" },
    { icon: Users, title: "Contact Management", description: "Centralized contact database with sync" },
    { icon: Zap, title: "Async Processing", description: "Background jobs never block your workflow" },
    { icon: LineChart, title: "Dashboard", description: "Operational command center with KPIs" }
  ];

  return (
    <div className="bg-background">
      <style>{`
        @keyframes radarPing {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(3); }
        }
        .radar-ping {
          animation: radarPing 2s infinite;
          transform-origin: center;
        }
      `}</style>

      {/* HERO */}
      <section
        className="bg-background py-24"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full bg-amber-400" />
                <span className="text-xs uppercase tracking-widest text-amber-400">
                  Signal Intelligence
                </span>
              </div>
              <h1 className="font-['Syne'] text-5xl font-bold text-foreground leading-tight">
                Powerful features for modern prospecting
              </h1>
              <p className="text-muted-foreground max-w-lg mt-4">
                Every feature designed to eliminate manual work and help you focus on what matters:
                building relationships with qualified clients.
              </p>
              <Link to="/auth/signup" className="inline-block mt-8">
                <div className="h-11 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </div>

            {/* Right — Radar graphic */}
            <div className="flex items-center justify-center">
              <div style={{ filter: "drop-shadow(0 0 20px rgba(59,130,246,0.15))" }}>
                <svg
                  width="320"
                  height="320"
                  viewBox="0 0 200 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Concentric rings */}
                  <circle cx="100" cy="100" r="30" stroke="rgba(59,130,246,0.15)" strokeWidth="1" fill="none" />
                  <circle cx="100" cy="100" r="60" stroke="rgba(59,130,246,0.15)" strokeWidth="1" fill="none" />
                  <circle cx="100" cy="100" r="90" stroke="rgba(59,130,246,0.15)" strokeWidth="1" fill="none" />
                  <circle cx="100" cy="100" r="120" stroke="rgba(59,130,246,0.15)" strokeWidth="1" fill="none" />
                  {/* Sweep line */}
                  <line
                    x1="100"
                    y1="100"
                    x2="185"
                    y2="15"
                    stroke="rgba(59,130,246,0.4)"
                    strokeWidth="1"
                  />
                  {/* Ping dot at sweep tip */}
                  <circle
                    cx="185"
                    cy="15"
                    r="3"
                    fill="#3b82f6"
                    className="radar-ping"
                  />
                  {/* Amber target dots */}
                  <circle cx="145" cy="75" r="2.5" fill="#f59e0b" />
                  <circle cx="65" cy="130" r="2.5" fill="#f59e0b" />
                  {/* Cross-hair lines */}
                  <line x1="100" y1="0" x2="100" y2="200" stroke="rgba(59,130,246,0.06)" strokeWidth="1" />
                  <line x1="0" y1="100" x2="200" y2="100" stroke="rgba(59,130,246,0.06)" strokeWidth="1" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN FEATURES */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-6">
            {mainFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="group rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0f1218] p-8 hover:border-blue-500/30 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/15 transition-colors">
                    <Icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="font-['Syne'] text-xl font-bold text-foreground mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">{feature.description}</p>
                  <ul>
                    {feature.details.map((detail, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-3 py-2 border-t border-[rgba(255,255,255,0.04)] first:border-t-0"
                      >
                        <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground/80">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* WORKFLOW STEPS */}
      <section className="py-24 bg-[#080a0d] border-y border-[rgba(255,255,255,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-amber-400" />
              <span className="text-xs uppercase tracking-widest text-amber-400">Workflow</span>
            </div>
            <h2 className="font-['Syne'] text-4xl font-bold text-foreground">
              Your guided workflow
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Every step is designed to be clear, actionable, and connected to the next.
            </p>
          </div>
          <div className="relative mt-16">
            <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] border-t border-dashed border-[rgba(255,255,255,0.08)]" />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {workflow.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="text-center">
                    <div className="w-16 h-16 rounded-full border-2 border-blue-500/30 bg-[#0f1218] mx-auto mb-5 flex items-center justify-center relative z-10">
                      <span className="font-['Syne'] font-bold text-lg text-blue-400">
                        {item.step}
                      </span>
                    </div>
                    <Icon className="h-5 w-5 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-foreground font-['Syne'] mb-2">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ADDITIONAL FEATURES */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-amber-400" />
              <span className="text-xs uppercase tracking-widest text-amber-400">More</span>
            </div>
            <h2 className="font-['Syne'] text-4xl font-bold text-foreground">And much more...</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {additionalFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={i}
                  className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0f1218] p-5 flex items-start gap-4 hover:border-blue-500/20 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex-shrink-0 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground font-['Syne'] mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-24">
        <div
          className="absolute inset-8 rounded-3xl pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(59,130,246,0.07) 0%, transparent 70%)",
          }}
        />
        <div className="relative max-w-2xl mx-auto px-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0f1218] p-12 text-center">
          <h2 className="font-['Syne'] text-3xl font-bold text-foreground mb-4">
            See it in action
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Start your free trial today and experience the complete client discovery platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/signup">
              <div className="h-11 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all">
                Get Started Free <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" className="h-11 px-6">
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
