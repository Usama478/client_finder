import { useEffect, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { api } from "../../../lib/api"
import { Search, Mail, Phone } from "lucide-react"

const Badge = ({ children, color }: { children: React.ReactNode; color: "green"|"blue"|"gray" }) => {
  const m = { green: ["rgba(16,185,129,0.1)","var(--chart-2)"], blue: ["rgba(59,130,246,0.15)","#60a5fa"], gray: ["var(--border)","var(--muted-foreground)"] }
  const [bg,text] = m[color]
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{background:bg,color:text}}>{children}</span>
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.contacts()
      .then(c => setContacts(c || []))
      .catch((e) => {
        console.error(e)
        toast.error("Failed to load contacts")
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = contacts.filter(c =>
    (c.business_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-6 space-y-4 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold text-foreground" style={{fontFamily:"Syne,sans-serif"}}>
            Contacts
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            Verified contact emails from all discovered leads
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{background:"var(--card)",border:"1px solid var(--border)"}}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search contacts…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-lg text-[13px] text-foreground outline-none w-full"
            style={{background:"var(--muted)",border:"1px solid var(--border)"}}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl" style={{border:"1px solid var(--border)"}}>
        <div className="grid text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4 py-3"
          style={{gridTemplateColumns:"1fr 1fr 140px 140px 120px 100px",background:"var(--muted)",borderBottom:"1px solid var(--border)"}}>
          <div>Business</div>
          <div>Email</div>
          <div>Phone</div>
          <div>Social</div>
          <div>Type</div>
          <div>Verified</div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="text-3xl mb-3 opacity-30">📧</div>
            <div className="text-sm font-bold text-foreground">No contacts yet</div>
            <div className="text-[12px] text-muted-foreground mt-1">
              Verify leads to extract contact emails
            </div>
          </div>
        )}

        {!loading && filtered.map((c, i) => {
          const socialLinks = c.social_links && typeof c.social_links === 'object' 
            ? Object.entries(c.social_links).filter(([k,v]) => v).slice(0, 3)
            : []
          return (
          <div key={c.result_id} className="grid items-center px-4 py-3 hover:bg-muted transition-colors"
            style={{gridTemplateColumns:"1fr 1fr 140px 140px 120px 100px",
              borderBottom:i<filtered.length-1?"1px solid var(--border)":"none",
              background:"var(--card)"}}>
            <div className="min-w-0">
              <Link to={`/app/business/${c.result_id}`} className="block text-[13px] font-semibold text-foreground hover:text-blue-400 truncate w-full">
                {c.business_name}
              </Link>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate w-full">{c.location}</div>
            </div>
            <div className="min-w-0">
              <a href={`mailto:${c.email}`} className="text-[12px] text-blue-400 hover:text-blue-300 flex items-center gap-1 w-full" title={c.email}>
                <Mail className="shrink-0 h-3 w-3" /><span className="truncate">{c.email}</span>
              </a>
            </div>
            <div className="text-[12px] text-muted-foreground">
              {c.phone ? <span className="flex items-center gap-1"><Phone className="h-3 w-3"/>{c.phone}</span> : "—"}
            </div>
            <div className="text-[11px] flex flex-wrap gap-1">
              {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">LinkedIn</a>}
              {socialLinks.map(([key, value]: [string, any]) => (
                <a key={key} href={value} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300">{key}</a>
              ))}
              {!c.linkedin && socialLinks.length === 0 && <span className="text-muted-foreground">—</span>}
            </div>
            <div>
              {c.email_type === "buying" || c.email_type === "sales"
                ? <Badge color="green">{c.email_type}</Badge>
                : <Badge color="gray">{c.email_type || "generic"}</Badge>}
            </div>
            <div>
              {c.verification_result === "verified"
                ? <Badge color="green">✓ Yes</Badge>
                : <Badge color="blue">Partial</Badge>}
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}
