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
  "Online Stores", "Department Stores", "Distributors",
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
          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
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
  const [keyProducts, setKeyProducts] = useState("")
  const [companyLocation, setCompanyLocation] = useState("")
  const [step1Error, setStep1Error] = useState("")
  const [step1Saving, setStep1Saving] = useState(false)

  const [buyerTypes, setBuyerTypes] = useState<string[]>([])
  const [targetMarkets, setTargetMarkets] = useState<string[]>([])
  const [contextId, setContextId] = useState<number | null>(null)
  const [step2Error, setStep2Error] = useState("")
  const [step2Saving, setStep2Saving] = useState(false)

  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState("")

  useEffect(() => {
    if (localStorage.getItem("cf_onboarding_done") === "true") {
      navigate("/app")
      return
    }
    api.getMyProfile()
      .then((profile) => {
        if (profile) {
          navigate("/app")
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
      if (targetMarkets[0] && productCategories[0]) {
        setSearchQuery(`${productCategories[0].toLowerCase()} buyers ${targetMarkets[0]}`)
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
    try {
      await api.createProfile({
        company_name: companyName,
        product_categories: productCategories,
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
    const buyerLabel = buyerTypes.length > 0 ? buyerTypes.join(", ") : "businesses"
    const marketLabel = targetMarkets.length > 0 ? targetMarkets.join(", ") : "international markets"
    const productLabel = productCategories.length > 0 ? productCategories.join(", ") : "our products"
    const prompt = `Find ${buyerLabel} in ${marketLabel} that buy ${productLabel} products for wholesale or bulk purchase.`
    try {
      const ctx = await api.createContext({ name: "Default", description: prompt, prompt_text: prompt })
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
    setSearchError("")
    setSearching(true)
    setHasSearched(true)
    try {
      const session = await api.createSession({
        search_query: searchQuery,
        discovery_platform: "both",
        context_id: contextId || undefined,
      })
      const results = await api.results(session.search_id)
      setSearchResults(results)
    } catch (err: any) {
      setSearchError(err?.message || "Search failed. Please try again.")
    } finally {
      setSearching(false)
    }
  }

  const finishOnboarding = () => {
    localStorage.setItem("cf_onboarding_done", "true")
    navigate("/app")
  }

  if (checking) {
    return <div className="min-h-screen bg-gray-50" />
  }

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">
        <div className="flex items-center gap-2 mb-6">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: "linear-gradient(135deg, #3b82f6, #1d4ed8)" }}
          >
            CF
          </div>
          <span className="font-bold text-base text-gray-900">Client Finder</span>
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
          <div className="text-xs text-gray-500">Step {step} of 3</div>
        </div>

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Tell us about your company</h2>
            <p className="text-sm text-gray-600 mb-4">This helps us find the right buyers for you.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Company name</label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Textiles Ltd"
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Product categories</label>
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
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Key products (comma-separated)</label>
                <Input
                  value={keyProducts}
                  onChange={(e) => setKeyProducts(e.target.value)}
                  placeholder="e.g. cotton fabric, bedsheets, towels"
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Company location (optional)</label>
                <Input
                  value={companyLocation}
                  onChange={(e) => setCompanyLocation(e.target.value)}
                  placeholder="e.g. Karachi, Pakistan"
                  className="bg-white border-gray-300 text-gray-900"
                />
              </div>
            </div>

            {step1Error && <div className="text-xs text-red-600 mt-3">{step1Error}</div>}

            <div className="flex items-center justify-between mt-6">
              <button onClick={handleStep1Skip} className="text-sm text-gray-500 hover:text-gray-700">
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
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Who are you looking for?</h2>
            <p className="text-sm text-gray-600 mb-4">Tell us about your ideal buyers.</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Buyer types</label>
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
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Target markets</label>
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
              </div>
            </div>

            {step2Error && <div className="text-xs text-red-600 mt-3">{step2Error}</div>}

            <div className="flex items-center justify-between mt-6">
              <button onClick={handleStep2Skip} className="text-sm text-gray-500 hover:text-gray-700">
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
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Try your first search</h2>
            <p className="text-sm text-gray-600 mb-4">Let's find some real buyers right now.</p>

            <div className="flex gap-2 mb-3">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for international buyers..."
                className="bg-white border-gray-300 text-gray-900 flex-1"
              />
              <Button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>

            {searchError && <div className="text-xs text-red-600 mb-3">{searchError}</div>}

            {searching && (
              <div className="flex items-center justify-center py-6">
                <div className="h-5 w-5 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
              </div>
            )}

            {!searching && hasSearched && (
              <div className="text-xs text-gray-500 mb-2">Found {searchResults.length} businesses</div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
                {searchResults.map((r) => (
                  <div
                    key={r.result_id}
                    className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{r.business_name}</div>
                      <div className="text-xs text-gray-500 truncate">{r.website || "—"}</div>
                      {r.address && <div className="text-xs text-gray-500 truncate">{r.address}</div>}
                    </div>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 flex-shrink-0 ml-2">
                      {r.source === "maps" ? "Maps" : "Web"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-6">
              <button onClick={finishOnboarding} className="text-sm text-gray-500 hover:text-gray-700">
                Skip for now →
              </button>
              <Button onClick={finishOnboarding} className="bg-blue-600 hover:bg-blue-700 text-white">
                Continue to Dashboard →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
