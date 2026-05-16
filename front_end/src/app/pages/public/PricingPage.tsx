import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { CheckCircle2, ArrowRight, HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";

export default function PricingPage() {
  const plans = [
    {
      name: "Starter",
      price: "$49",
      period: "/month",
      description: "Perfect for freelancers and solo exporters getting started",
      features: [
        "100 business searches per month",
        "500 AI relevancy checks",
        "100 verification scans",
        "50 email sends",
        "Basic analytics dashboard",
        "Email support",
        "1 search context",
        "CSV export"
      ],
      cta: "Start Free Trial",
      highlight: false
    },
    {
      name: "Professional",
      price: "$149",
      period: "/month",
      description: "For growing teams and agencies with higher volume needs",
      features: [
        "Unlimited business searches",
        "2,000 AI relevancy checks",
        "500 verification scans",
        "300 email sends",
        "Advanced analytics & reporting",
        "Priority email support",
        "10 search contexts",
        "CSV & API export",
        "Team collaboration features",
        "Custom email templates"
      ],
      cta: "Start Free Trial",
      highlight: true,
      badge: "Most Popular"
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations with specific requirements",
      features: [
        "Unlimited everything",
        "Custom AI threshold configuration",
        "Unlimited verifications",
        "Unlimited email sends",
        "Custom integrations",
        "Dedicated account manager",
        "Unlimited search contexts",
        "Advanced API access",
        "SSO & SAML support",
        "Custom SLA",
        "White-label options"
      ],
      cta: "Contact Sales",
      highlight: false
    }
  ];

  const faqs = [
    {
      question: "How does the free trial work?",
      answer: "You get full access to the Professional plan for 14 days, no credit card required. After the trial, you can choose to upgrade to a paid plan or continue with limited free access."
    },
    {
      question: "What counts as a 'search'?",
      answer: "A search is a single query run against our business database. Each search can return multiple results, and you can save and reload past searches without counting against your limit."
    },
    {
      question: "How does verification work?",
      answer: "Each verification is a deep trust check on a single business, including website credibility, legal entity status, contact validation, and social presence. Partial verifications (when some data is unavailable) still count toward your quota."
    },
    {
      question: "Can I upgrade or downgrade my plan?",
      answer: "Yes, you can change your plan at any time. Upgrades take effect immediately, while downgrades apply at the start of your next billing cycle."
    },
    {
      question: "What happens if I exceed my limits?",
      answer: "We'll notify you when you approach your limits. You can upgrade your plan mid-cycle to get more capacity, or wait until the next billing period when your quotas reset."
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use enterprise-grade encryption for all data at rest and in transit. Your search data, client information, and email content are isolated to your workspace and never shared."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 30-day money-back guarantee on all paid plans. If you're not satisfied for any reason within the first 30 days, we'll issue a full refund."
    },
    {
      question: "Can I export my data?",
      answer: "Yes, all plans include CSV export. Professional and Enterprise plans also include API access for automated data export and integration with your existing tools."
    }
  ];

  return (
    <div className="bg-background">
      {/* HERO */}
      <section
        className="bg-background py-24"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-amber-400" />
            <span className="text-xs uppercase tracking-widest text-amber-400">Pricing</span>
          </div>
          <h1 className="font-['Syne'] text-5xl font-bold text-foreground">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground mt-3">
            Choose the plan that fits your business. All plans include a 14-day free trial.
          </p>
          <div className="inline-flex items-center mt-6 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#0f1218] p-1">
            <button className="rounded-md bg-blue-600 text-white text-sm px-4 py-1.5 font-medium">
              Monthly
            </button>
            <button className="text-muted-foreground text-sm px-4 py-1.5">
              Annual{" "}
              <span className="ml-1.5 text-xs bg-amber-400/20 text-amber-400 rounded-full px-1.5">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* PRICING CARDS */}
      <section className="pb-24 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8 pt-16">
            {plans.map((plan, i) =>
              plan.highlight ? (
                <div
                  key={i}
                  className="rounded-xl border border-blue-500/50 bg-[#080e1a] p-8 relative"
                  style={{
                    boxShadow:
                      "0 0 60px rgba(59,130,246,0.12), 0 0 0 1px rgba(59,130,246,0.2)",
                  }}
                >
                  <div className="text-xs font-bold tracking-[0.15em] text-amber-400 uppercase mb-6 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-amber-400" />
                    Most Popular
                  </div>
                  <p className="text-xl font-bold font-['Syne'] text-foreground">
                    {plan.name}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1 mb-6 min-h-[40px]">
                    {plan.description}
                  </p>
                  <div>
                    <span className="text-5xl font-bold font-['Syne'] text-foreground">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground text-base">{plan.period}</span>
                    )}
                  </div>
                  <div className="border-t border-[rgba(255,255,255,0.06)] my-6" />
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm text-foreground/80">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <div className="w-full h-11 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all">
                      <Link to="/auth/signup" className="flex items-center gap-2">
                        {plan.cta} <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={i}
                  className="rounded-xl border border-[rgba(255,255,255,0.07)] bg-[#0f1218] p-8 relative"
                >
                  <p className="text-xl font-bold font-['Syne'] text-foreground">{plan.name}</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-6 min-h-[40px]">
                    {plan.description}
                  </p>
                  <div>
                    <span className="text-5xl font-bold font-['Syne'] text-foreground">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-muted-foreground text-base">{plan.period}</span>
                    )}
                  </div>
                  <div className="border-t border-[rgba(255,255,255,0.06)] my-6" />
                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3 text-sm text-foreground/80">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Button variant="outline" className="w-full h-11">
                      <Link
                        to={plan.name === "Enterprise" ? "#contact" : "/auth/signup"}
                        className="flex items-center gap-2"
                      >
                        {plan.name === "Enterprise" ? (
                          "Talk to us →"
                        ) : (
                          <>
                            {plan.cta} <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Link>
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-background pt-0 pb-24">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-amber-400" />
            <span className="text-xs uppercase tracking-widest text-amber-400">FAQ</span>
          </div>
          <h2 className="font-['Syne'] text-4xl font-bold text-foreground mb-10">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="border border-[rgba(255,255,255,0.06)] bg-[#0f1218] rounded-xl mb-3 px-2 overflow-hidden border-b-0"
              >
                <AccordionTrigger className="text-left hover:no-underline">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <span className="text-foreground text-sm font-medium">{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm pl-8 pb-4">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* BOTTOM CTA */}
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
            Ready to get started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Join hundreds of exporters and B2B teams using Client Finder to discover, verify, and
            contact their ideal clients.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth/signup">
              <div className="h-11 px-6 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-all">
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
            <Link to="/features">
              <Button variant="outline" className="h-11 px-6">
                View All Features
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
