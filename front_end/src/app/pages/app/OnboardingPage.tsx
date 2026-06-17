import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { api } from "../../../lib/api"

const PRODUCT_CATEGORIES = [
  "Textiles", "Garments", "Home Textiles", "Knitwear",
  "Leather Goods", "Sports Goods", "Surgical Instruments", "Other",
]

const BUYER_TYPES = [
  "Retailers", "Boutiques", "Wholesalers",
  "Online Stores", "Department Stores", "Distributors", "Other"
]

const TARGET_MARKETS = [
  "United Kingdom", "United States", "Germany", "France", "Australia",
  "Canada", "Netherlands", "Italy", "Spain", "Other",
]

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm cursor-pointer transition-colors ${
        selected
          ? "bg-blue-600 text-white border-blue-600"
          : "bg-background text-foreground border-border hover:border-blue-400"
      }`}
    >
      {label}
    </button>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [step, setStep] = useState(1)

  const [credits, setCredits] = useState<{ credits_remaining: number } | null>(null)

  const [companyName, setCompanyName] = useState("")
  const [productCategories, setProductCategories] = useState<string[]>([])
  const [otherProduct, setOtherProduct] = useState("")
  const [keyProducts, setKeyProducts] = useState("")
  const [companyLocation, setCompanyLocation] = useState("")
  const [step1Error, setStep1Error] = useState("")
  const [step1Saving, setStep1Saving] = useState(false)

  const [buyerTypes, setBuyerTypes] = useState<string[]>([])
  const [otherBuyer, setOtherBuyer] = useState("")
  const [targetMarkets, setTargetMarkets] = useState<string[]>([])
  const [otherMarket, setOtherMarket] = useState("")
  const [contextId, setContextId] = useState<number | null>(null)
  const [step2Error, setStep2Error] = useState("")
  const [step2Saving, setStep2Saving] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (localStorage.getItem("cf_onboarding_done") === "true") {
      navigate("/app/simple-search")
      return
    }
    api.getMyProfile()
      .then((profile) => {
        if (profile) {
          navigate("/app/simple-search")
        } else {
          setChecking(false)
        }
      })
      .catch(() => setChecking(false))
  }, [])

  useEffect(() => {
    api.credits().then(setCredits).catch(() => {})
  }, [])

  useEffect(() => {
    if (step === 3 && !searchQuery) {
      const p = productCategories[0] === "Other" && otherProduct.trim() ? otherProduct.trim() : productCategories[0];
      const m = targetMarkets[0] === "Other" && otherMarket.trim() ? otherMarket.trim() : targetMarkets[0];
      if (m && p) {
        setSearchQuery(`${p.toLowerCase()} buyers ${m}`)
      } else {
        setSearchQuery("fashion boutiques United Kingdom")
      }
    }
  }, [step])

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const handleStep1Continue = async () => {
    setStep1Error("")
    if (!companyName.trim() || !keyProducts.trim()) {
      setStep1Error("Company name and key products are required.")
      return
    }
    setStep1Saving(true)
    const finalCategories = productCategories.map(c => c === "Other" && otherProduct.trim() ? otherProduct.trim() : c)
    try {
      await api.createProfile({
        company_name: companyName,
        product_categories: finalCategories,
        key_products: keyProducts.split(",").map((s) => s.trim()).filter(Boolean),
        company_location: companyLocation || undefined,
        is_default: true,
        profile_name: "Default",
      })
      setStep(2)
    } catch (err: any) {
      setStep1Error(err?.message || "Failed to save your profile.")
    } finally {
      setStep1Saving(false)
    }
  }

  const handleStep1Skip = () => {
    localStorage.setItem("cf_onboarding_skipped_step1", "true")
    setStep(2)
  }

  const handleStep2Continue = async () => {
    setStep2Error("")
    setStep2Saving(true)
    const finalBuyers = buyerTypes.map(b => b === "Other" && otherBuyer.trim() ? otherBuyer.trim() : b)
    const finalMarkets = targetMarkets.map(m => m === "Other" && otherMarket.trim() ? otherMarket.trim() : m)
    const buyerLabel = finalBuyers.length > 0 ? finalBuyers.join(", ") : "businesses"
    const marketLabel = finalMarkets.length > 0 ? finalMarkets.join(", ") : "international markets"
    
    const finalCategories = productCategories.map(c => c === "Other" && otherProduct.trim() ? otherProduct.trim() : c)
    const productLabel = finalCategories.length > 0 ? finalCategories.join(", ") : "our products"
    
    const prompt = `Find ${buyerLabel} in ${marketLabel} that buy ${productLabel} products for wholesale or bulk purchase.`
    
    const promptTextLines = [
      "EXPORTER PROFILE",
      `Business Type: `,
      `Products: ${keyProducts}`,
      `Product Categories: ${finalCategories.join(", ")}`,
      `Country of Origin: ${companyLocation}`,
      `Current Export Markets: `,
      "",
      "WHAT I AM LOOKING FOR",
      `Target Buyer Type: ${finalBuyers.join(", ")}`,
      `Target Business Size: `,
      `Target Countries: ${finalMarkets.join(", ")}`,
      `Preferred Niches: `,
      "",
      "WHAT TO AVOID",
      `Exclude Business Types: `,
      `Exclude Countries: `,
      "",
      "OUTREACH CONTEXT",
      `My Value Proposition: `,
      `Tone of Outreach: `
    ]
    const promptText = promptTextLines.join("\n")

    try {
      const ctx = await api.createContext({ name: "Default", description: prompt, prompt_text: promptText })
      setContextId(ctx.id)
    } catch (err: any) {
      setStep2Error(err?.message || "Failed to save your targeting preferences, but you can continue.")
    } finally {
      setStep2Saving(false)
      setStep(3)
    }
  }

  const handleStep2Skip = () => setStep(3)

  const handleSearch = async () => {
    localStorage.setItem("cf_onboarding_done", "true")
    navigate("/app/simple-search", { state: { autoSearch: searchQuery } })
  }

  const finishOnboarding = () => {
    localStorage.setItem("cf_onboarding_done", "true")
    navigate("/app/simple-search")
  }

  if (checking) {
    return <div className="min-h-screen bg-gray-50" />
  }

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
          >
            CF
          </div>
          <span className="font-bold text-base text-foreground">Client Finder</span>
        </div>

        {credits && step === 1 && (
          <div className="text-xs text-blue-600 mb-4">
            You have {credits.credits_remaining} free credits to get started
          </div>
        )}

        <div className="mb-6">
          <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden mb-1.5">
            <div className="h-1.5 rounded-full bg-blue-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">Step {step} of 3</div>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Tell us about your company</h2>
            <p className="text-sm text-muted-foreground mb-4">This helps us find the right buyers for you.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Company name</label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Textiles Ltd"
                  className="bg-background border-border text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Product categories</label>
                <div className="flex flex-wrap gap-2">
                  {PRODUCT_CATEGORIES.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      selected={productCategories.includes(c)}
                      onClick={() => toggle(productCategories, setProductCategories, c)}
                    />
                  ))}
                </div>
                {productCategories.includes("Other") && (
                  <Input 
                    value={otherProduct}
                    onChange={(e) => setOtherProduct(e.target.value)}
                    placeholder="Please specify other category..."
                    className="mt-2 text-sm bg-background border-border text-foreground"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Key products (comma-separated)</label>
                <Input
                  value={keyProducts}
                  onChange={(e) => setKeyProducts(e.target.value)}
                  placeholder="e.g. cotton fabric, bedsheets, towels"
                  className="bg-background border-border text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Company location (optional)</label>
                <Input
                  value={companyLocation}
                  onChange={(e) => setCompanyLocation(e.target.value)}
                  placeholder="e.g. Karachi, Pakistan"
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>

            {step1Error && <div className="text-xs text-red-600 mt-3">{step1Error}</div>}

            <div className="flex items-center justify-between mt-6">
              <button onClick={handleStep1Skip} className="text-sm text-muted-foreground hover:text-foreground">
                Skip for now →
              </button>
              <Button onClick={handleStep1Continue} disabled={step1Saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {step1Saving ? "Saving..." : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Who are you looking for?</h2>
            <p className="text-sm text-muted-foreground mb-4">Tell us about your ideal buyers.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Buyer types</label>
                <div className="flex flex-wrap gap-2">
                  {BUYER_TYPES.map((b) => (
                    <Chip
                      key={b}
                      label={b}
                      selected={buyerTypes.includes(b)}
                      onClick={() => toggle(buyerTypes, setBuyerTypes, b)}
                    />
                  ))}
                </div>
                {buyerTypes.includes("Other") && (
                  <Input 
                    value={otherBuyer}
                    onChange={(e) => setOtherBuyer(e.target.value)}
                    placeholder="Please specify other buyer type..."
                    className="mt-2 text-sm bg-background border-border text-foreground"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Target markets</label>
                <div className="flex flex-wrap gap-2">
                  {TARGET_MARKETS.map((m) => (
                    <Chip
                      key={m}
                      label={m}
                      selected={targetMarkets.includes(m)}
                      onClick={() => toggle(targetMarkets, setTargetMarkets, m)}
                    />
                  ))}
                </div>
                {targetMarkets.includes("Other") && (
                  <Input 
                    value={otherMarket}
                    onChange={(e) => setOtherMarket(e.target.value)}
                    placeholder="Please specify other market..."
                    className="mt-2 text-sm bg-background border-border text-foreground"
                  />
                )}
              </div>
            </div>

            {step2Error && <div className="text-xs text-red-600 mt-3">{step2Error}</div>}

            <div className="flex items-center justify-between mt-6">
              <button onClick={handleStep2Skip} className="text-sm text-muted-foreground hover:text-foreground">
                Skip for now →
              </button>
              <Button onClick={handleStep2Continue} disabled={step2Saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {step2Saving ? "Saving..." : "Continue"}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Try your first search</h2>
            <p className="text-sm text-muted-foreground mb-4">Let's find some real buyers right now.</p>

            <div className="flex gap-2 mb-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for international buyers..."
                className="bg-background border-border text-foreground flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) handleSearch() }}
              />
              <Button
                onClick={handleSearch}
                disabled={!searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Search
              </Button>
            </div>

            <div className="flex items-center justify-between mt-6">
              <button onClick={finishOnboarding} className="text-sm text-muted-foreground hover:text-foreground">
                Skip for now →
              </button>
              <Button onClick={finishOnboarding} className="bg-blue-600 hover:bg-blue-700 text-white">
                Continue to Search →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
