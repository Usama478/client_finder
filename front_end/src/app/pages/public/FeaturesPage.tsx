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
    <div className="bg-white">
      <section className="bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Powerful features for modern prospecting
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Every feature designed to eliminate manual work and help you focus on what matters: 
              building relationships with qualified clients.
            </p>
            <Link to="/auth/signup">
              <Button size="lg">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {mainFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card key={i} className="border-2">
                  <CardHeader>
                    <div className="h-14 w-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="h-7 w-7 text-blue-700" />
                    </div>
                    <CardTitle className="text-2xl">{feature.title}</CardTitle>
                    <p className="text-gray-600 mt-2">{feature.description}</p>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feature.details.map((detail, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Your guided workflow</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Every step is designed to be clear, actionable, and connected to the next.
            </p>
          </div>
          <div className="flex flex-col lg:flex-row items-start justify-center gap-8">
            {workflow.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex-1 text-center max-w-xs mx-auto">
                  <div className="relative">
                    <div className="h-20 w-20 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                      {item.step}
                    </div>
                    {i < workflow.length - 1 && (
                      <ArrowRight className="hidden lg:block absolute top-10 -right-12 text-gray-300 h-8 w-8" />
                    )}
                  </div>
                  <Icon className="h-8 w-8 text-blue-700 mx-auto mb-3" />
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">And much more...</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {additionalFeatures.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card key={i}>
                  <CardContent className="p-6 text-center">
                    <Icon className="h-10 w-10 text-blue-700 mx-auto mb-3" />
                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6">
            See it in action
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Start your free trial today and experience the complete client discovery platform.
          </p>
          <Link to="/auth/signup">
            <Button size="lg" variant="secondary">
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
