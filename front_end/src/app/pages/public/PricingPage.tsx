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
    <div className="bg-white">
      <section className="bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Simple, transparent pricing
            </h1>
            <p className="text-xl text-gray-600 mb-4">
              Choose the plan that fits your business. All plans include a 14-day free trial.
            </p>
            <p className="text-sm text-gray-500">
              No credit card required • Cancel anytime • 30-day money-back guarantee
            </p>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, i) => (
              <Card 
                key={i} 
                className={`relative ${
                  plan.highlight 
                    ? 'border-blue-600 border-2 shadow-xl scale-105' 
                    : 'border-2'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600 text-white">{plan.badge}</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <p className="text-sm text-gray-600 mb-6 min-h-[40px]">{plan.description}</p>
                  <div className="mb-2">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-gray-600 text-lg">{plan.period}</span>}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={plan.name === "Enterprise" ? "#contact" : "/auth/signup"}>
                    <Button 
                      className="w-full" 
                      variant={plan.highlight ? "default" : "outline"}
                      size="lg"
                    >
                      {plan.cta} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently asked questions</h2>
            <p className="text-gray-600">Everything you need to know about pricing and plans</p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{faq.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-gray-600 pl-8">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0">
            <CardContent className="p-12 text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Join hundreds of exporters and B2B teams using Client Finder to discover, 
                verify, and contact their ideal clients.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth/signup">
                  <Button size="lg" variant="secondary">
                    Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/features">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="bg-transparent text-white border-white hover:bg-white/10"
                  >
                    View All Features
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
