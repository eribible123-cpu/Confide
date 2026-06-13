import { useState, useEffect, useRef } from "react";
import { supabase } from './supabase.js'
const C = {
  ink: "#1a1612", parchment: "#f7f3ec", cream: "#ede8df",
  rust: "#b84c2b", rustLight: "#f0d5cc",
  sage: "#4a6358", sageLight: "#d4e0db",
  gold: "#b8860b", goldLight: "#fdf3d0",
  muted: "#7a6f65", border: "#d6cfc4", white: "#ffffff",
};

const ADMIN_PASSWORD = "admin123";
const STORAGE_KEY = "advice_platform_v3";
const AD_SKIP_AFTER = 5;
const AD_CPM = 0.002; // $0.002 per view (simulated)
const LAST_VISIT_KEY = "confide_last_visit";

const PLANS = {
  free:  { id:"free",  label:"Free",          price:0,   priceLabel:"Free",      desc:"Submit with no guarantee of a reply.", badge:null },
  reply: { id:"reply", label:"Pay-per-Reply",  price:50,  priceLabel:"GHS 50",    desc:"One guaranteed personal reply.", badge:"Most popular" },
  sub:   { id:"sub",   label:"Subscriber",     price:100, priceLabel:"GHS 100/mo",desc:"Priority queue, unlimited replies.", badge:"Best value" },
};
const TIP_AMOUNTS = [3, 5, 10, 20];

const MOCK_ADS = [
  { id:"a1", brand:"BetterHelp", headline:"Talk to a real therapist today.", sub:"Professional support, on your schedule.", cta:"Try free for a week", color:"#2d6a8a", bg:"#e8f4f9", emoji:"🧠" },
  { id:"a2", brand:"Calm",       headline:"Sleep better. Stress less.",       sub:"Guided meditations for anxious minds.", cta:"Download free",        color:"#4a7c6f", bg:"#e4f0ed", emoji:"🌿" },
  { id:"a3", brand:"Headspace",  headline:"A few minutes a day changes everything.", sub:"Mindfulness that actually sticks.", cta:"Start today",       color:"#e86c2c", bg:"#fdf0e8", emoji:"🧘" },
  { id:"a4", brand:"Noom",       headline:"Change how you think about food.", sub:"Psychology-based wellness coaching.", cta:"Take the quiz",          color:"#7a5ea0", bg:"#f0ebf9", emoji:"🌱" },
];
// Smaller inline banner ads
const BANNER_ADS = [
  { id:"b1", brand:"BetterHelp", text:"Feeling stuck? Talk to a licensed therapist.", cta:"Get started →", color:"#2d6a8a", bg:"#e8f4f9" },
  { id:"b2", brand:"Calm",       text:"Try 7 days of Calm — free.",                   cta:"Download →",    color:"#4a7c6f", bg:"#e4f0ed" },
  { id:"b3", brand:"Headspace",  text:"Meditation for real life. Start in minutes.",  cta:"Try free →",    color:"#e86c2c", bg:"#fdf0e8" },
];

function genId() { return Math.random().toString(36).slice(2, 10); }
function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
function fmtMoney(cents) { return `$${(cents / 100).toFixed(2)}`; }
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function saveSubmission(sub) {
  const { error } = await supabase.from('submissions').insert([{
    name: sub.name,
    email: sub.email,
    subject: sub.subject,
    body: sub.body,
    is_public: sub.isPublic,
    anonymous: sub.anonymous,
    plan: sub.plan,
    paid: sub.paid,
    status: sub.status,
  }])
  if (error) console.error(error)
}

async function loadSubmissions() {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) console.error(error)
  return data || []
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const gs = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${C.parchment}; color: ${C.ink}; font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; min-height: 100vh; }
  .display { font-family: 'Playfair Display', serif; }
  input, textarea { font-family: 'Inter', sans-serif; font-size: 14px; outline: none; }
  button { cursor: pointer; font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: ${C.cream}; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
  @keyframes countdown { from { width: 100%; } to { width: 0%; } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
`;
const inp = { width:"100%", padding:"10px 14px", background:C.white, border:`1.5px solid ${C.border}`, borderRadius:8, color:C.ink };
const lbl = { display:"block", fontSize:12, fontWeight:600, color:C.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" };

// ─── Badges ────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = { new:{color:C.rust,bg:C.rustLight,label:"New"}, replied:{color:C.sage,bg:C.sageLight,label:"Replied"}, pending:{color:"#8a7a5a",bg:"#ede8d5",label:"Pending"} };
  const s = map[status]||map.new;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:5, background:s.bg, color:s.color, fontSize:11, fontWeight:600, letterSpacing:"0.06em", padding:"3px 10px", borderRadius:20, textTransform:"uppercase" }}><span style={{ width:7,height:7,borderRadius:"50%",background:s.color }} />{s.label}</span>;
}
function PlanBadge({ plan }) {
  if (plan==="free") return null;
  const map = { reply:{color:C.rust,bg:C.rustLight,label:"Paid Reply"}, sub:{color:C.gold,bg:C.goldLight,label:"Subscriber"} };
  const s = map[plan]; if (!s) return null;
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:s.bg, color:s.color, fontSize:11, fontWeight:600, letterSpacing:"0.06em", padding:"3px 10px", borderRadius:20, textTransform:"uppercase" }}>★ {s.label}</span>;
}

// ─── Entry Ad Interstitial ─────────────────────────────────────────────────────
function EntryAd({ onClose, data, setData }) {
  const [secondsLeft, setSecondsLeft] = useState(AD_SKIP_AFTER);
  const [canSkip, setCanSkip] = useState(false);
  const ad = useRef(pickRandom(MOCK_ADS)).current;

  useEffect(() => {
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { setCanSkip(true); clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  function dismiss() {
    // Log ad revenue
    const rev = [{ id:genId(), type:"ad_view", amount:Math.round(AD_CPM*100), adId:ad.id, brand:ad.brand, at:Date.now() }, ...data.revenue];
    const updated = { ...data, revenue:rev };
    setData(updated); 
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,22,18,0.92)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ width:"100%", maxWidth:440, animation:"fadeIn 0.3s ease" }}>
        {/* Skip / timer row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <span style={{ color:"#888", fontSize:12, letterSpacing:"0.04em" }}>ADVERTISEMENT</span>
          {canSkip
            ? <button onClick={dismiss} style={{ background:C.white, border:"none", color:C.ink, padding:"6px 16px", borderRadius:6, fontSize:13, fontWeight:700 }}>Skip Ad ✕</button>
            : <span style={{ color:"#888", fontSize:13, background:"#333", padding:"6px 14px", borderRadius:6 }}>Skip in {secondsLeft}s</span>
          }
        </div>

        {/* Countdown bar */}
        <div style={{ height:3, background:"#333", borderRadius:2, marginBottom:20, overflow:"hidden" }}>
          <div style={{ height:"100%", background:C.rust, borderRadius:2, width:`${(secondsLeft/AD_SKIP_AFTER)*100}%`, transition:"width 1s linear" }} />
        </div>

        {/* Ad card */}
        <div style={{ background:ad.bg, borderRadius:14, padding:"32px 28px", textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:16 }}>{ad.emoji}</div>
          <div style={{ fontSize:11, fontWeight:700, color:ad.color, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:10 }}>{ad.brand}</div>
          <h2 className="display" style={{ fontSize:26, lineHeight:1.3, marginBottom:10, color:C.ink }}>{ad.headline}</h2>
          <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>{ad.sub}</p>
          <button style={{ background:ad.color, color:C.white, border:"none", padding:"12px 28px", borderRadius:8, fontSize:14, fontWeight:600 }}>
            {ad.cta}
          </button>
          <p style={{ marginTop:16, fontSize:11, color:"#aaa" }}>Sponsored · This ad supports Confide</p>
        </div>
      </div>
    </div>
  );
}

// ─── Banner Ad ─────────────────────────────────────────────────────────────────
function BannerAd({ style }) {
  const ad = useRef(pickRandom(BANNER_ADS)).current;
  return (
    <div style={{ background:ad.bg, border:`1px solid ${ad.color}22`, borderLeft:`3px solid ${ad.color}`, borderRadius:8, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, ...style }}>
      <div style={{ flex:1 }}>
        <span style={{ fontSize:10, fontWeight:700, color:ad.color, textTransform:"uppercase", letterSpacing:"0.08em" }}>Sponsored · {ad.brand}</span>
        <p style={{ fontSize:13, color:C.ink, marginTop:2 }}>{ad.text}</p>
      </div>
      <button style={{ background:ad.color, color:C.white, border:"none", padding:"7px 14px", borderRadius:6, fontSize:12, fontWeight:600, whiteSpace:"nowrap", flexShrink:0 }}>{ad.cta}</button>
    </div>
  );
}

// ─── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ amount, label, onSuccess, onCancel, email }) {
  useEffect(() => {
      console.log('Paystack key:', import.meta.env.VITE_PAYSTACK_PUBLIC_KEY);
    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '',
      email: email || 'anonymous@confide.app',
      amount: amount * 100,
      currency: 'GHS',
      callback: function(response) {
        if (response.status === 'success') onSuccess();
      },
      onClose: function() {
        onCancel();
      }
    });
    handler.openIframe();
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,22,18,0.7)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:C.white, borderRadius:14, padding:32, textAlign:"center" }}>
        <p style={{ marginBottom:16 }}>Opening payment window...</p>
        <button onClick={onCancel} style={{ background:"none", border:`1px solid ${C.border}`, padding:"10px 20px", borderRadius:8 }}>Cancel</button>
      </div>
    </div>
  );
}
// ─── Tip Modal ─────────────────────────────────────────────────────────────────
function TipModal({ submission, onSuccess, onCancel }) {
  const [amount, setAmount] = useState(5);
  const [custom, setCustom] = useState("");
  const [paying, setPaying] = useState(false);
  const finalAmount = custom ? parseFloat(custom) : amount;
  if (paying) return <PaymentModal amount={finalAmount} label={`Tip for: "${submission.subject}"`} onSuccess={onSuccess} onCancel={()=>setPaying(false)} />;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(26,22,18,0.7)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:14, padding:32, width:"100%", maxWidth:360 }}>
        <div className="display" style={{ fontSize:22, marginBottom:6 }}>Leave a tip</div>
        <p style={{ color:C.muted, fontSize:14, marginBottom:24 }}>If the reply helped, show some appreciation.</p>
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {TIP_AMOUNTS.map(a=>(
            <button key={a} onClick={()=>{ setAmount(a); setCustom(""); }} style={{ flex:1, minWidth:60, padding:"10px 0", borderRadius:8, fontSize:14, fontWeight:600, background:amount===a&&!custom?C.ink:C.cream, color:amount===a&&!custom?C.white:C.ink, border:"none" }}>${a}</button>
          ))}
        </div>
        <input value={custom} onChange={e=>setCustom(e.target.value)} placeholder="Custom amount" type="number" min="1" style={{ ...inp, marginBottom:20 }} />
        <button onClick={()=>setPaying(true)} disabled={!finalAmount||finalAmount<1} style={{ width:"100%", background:C.gold, color:C.white, border:"none", padding:"13px", borderRadius:8, fontSize:15, fontWeight:600, marginBottom:10, opacity:(!finalAmount||finalAmount<1)?0.5:1 }}>Tip ${finalAmount||"—"} ★</button>
        <button onClick={onCancel} style={{ width:"100%", background:"none", border:`1px solid ${C.border}`, color:C.muted, padding:"10px", borderRadius:8, fontSize:14 }}>Maybe later</button>
      </div>
    </div>
  );
}

// ─── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ view, setView, currentUser, setCurrentUser }) {
  return (
    <header style={{ background:C.ink, color:C.parchment, padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:56, position:"sticky", top:0, zIndex:100 }}>
      <button onClick={()=>setView("home")} style={{ background:"none", border:"none", color:C.parchment }}>
        <span className="display" style={{ fontSize:22, fontStyle:"italic" }}>Confide</span>
      </button>
      <nav style={{ display:"flex", gap:4, alignItems:"center" }}>
        {[["home","Home"],["browse","Browse"],["submit","Share a Problem"],["pricing","Pricing"]].map(([v,l])=>(
          <button key={v} onClick={()=>setView(v)} style={{ background:view===v?C.rust:"none", border:"none", color:view===v?C.white:C.border, padding:"6px 14px", borderRadius:6, fontSize:13, fontWeight:500 }}>{l}</button>
        ))}
        {currentUser && <button onClick={()=>setView("my")} style={{ background:view==="my"?C.rust:"none", border:"none", color:view==="my"?C.white:C.border, padding:"6px 14px", borderRadius:6, fontSize:13, fontWeight:500 }}>My Submissions</button>}
        <div style={{ width:1, height:20, background:"#444", margin:"0 6px" }} />
        {currentUser
          ? <button onClick={()=>setCurrentUser(null)} style={{ background:"none", border:"1px solid #444", color:C.border, padding:"5px 12px", borderRadius:6, fontSize:13 }}>Sign Out</button>
          : <button onClick={()=>setView("login")} style={{ background:"none", border:"1px solid #444", color:C.border, padding:"5px 12px", borderRadius:6, fontSize:13 }}>Sign In</button>
        }
        <button onClick={()=>setView("admin")} style={{ background:view==="admin"?"#333":"none", border:"none", color:"#666", padding:"6px 10px", borderRadius:6, fontSize:12 }} title="Admin">⚙</button>
      </nav>
    </header>
  );
}

// ─── Home ──────────────────────────────────────────────────────────────────────
function HomeView({ setView }) {
  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"72px 24px 48px" }}>
      <p style={{ color:C.rust, fontWeight:600, fontSize:12, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:16 }}>A place to be heard</p>
      <h1 className="display" style={{ fontSize:"clamp(36px,6vw,56px)", lineHeight:1.15, marginBottom:24, letterSpacing:"-0.02em" }}>Whatever's weighing on you,<br /><em>write it down.</em></h1>
      <p style={{ fontSize:17, color:C.muted, lineHeight:1.75, marginBottom:40, maxWidth:520 }}>Share your problem and receive a thoughtful, personal reply. No algorithms, no bots — just a human reading and responding.</p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:48 }}>
        <button onClick={()=>setView("submit")} style={{ background:C.rust, color:C.white, border:"none", padding:"14px 28px", borderRadius:8, fontSize:15, fontWeight:600 }}>Share a Problem →</button>
        <button onClick={()=>setView("pricing")} style={{ background:"none", color:C.ink, border:`1.5px solid ${C.border}`, padding:"14px 28px", borderRadius:8, fontSize:15, fontWeight:500 }}>See pricing</button>
      </div>
      <BannerAd style={{ marginBottom:40 }} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
        {[
          { icon:"✉", title:"Anonymous or named", body:"Your choice how much to share." },
          { icon:"💳", title:"Free or paid", body:"Pay for a guaranteed reply, or try for free." },
          { icon:"💬", title:"Real replies", body:"Every submission is read and answered personally." },
        ].map(({icon,title,body})=>(
          <div key={title} style={{ background:C.cream, padding:20, borderRadius:10, borderTop:`3px solid ${C.border}` }}>
            <div style={{ fontSize:24, marginBottom:10 }}>{icon}</div>
            <div style={{ fontWeight:600, marginBottom:6, fontSize:14 }}>{title}</div>
            <div style={{ color:C.muted, fontSize:13, lineHeight:1.6 }}>{body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing ───────────────────────────────────────────────────────────────────
function PricingView({ setView }) {
  return (
    <div style={{ maxWidth:760, margin:"0 auto", padding:"56px 24px" }}>
      <h2 className="display" style={{ fontSize:34, marginBottom:8, textAlign:"center" }}>Simple, honest pricing</h2>
      <p style={{ color:C.muted, textAlign:"center", marginBottom:48 }}>Choose how you'd like to engage.</p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20, marginBottom:32 }}>
        {Object.values(PLANS).map(p=>(
          <div key={p.id} style={{ background:p.id==="sub"?C.ink:C.white, color:p.id==="sub"?C.parchment:C.ink, border:`1.5px solid ${p.id==="reply"?C.rust:p.id==="sub"?C.ink:C.border}`, borderRadius:12, padding:28, position:"relative" }}>
            {p.badge && <span style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)", background:p.id==="sub"?C.gold:C.rust, color:C.white, fontSize:11, fontWeight:700, padding:"3px 12px", borderRadius:20, whiteSpace:"nowrap" }}>{p.badge}</span>}
            <div style={{ fontSize:13, fontWeight:600, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:8, color:p.id==="sub"?C.border:C.muted }}>{p.label}</div>
            <div className="display" style={{ fontSize:36, fontWeight:700, marginBottom:4 }}>{p.priceLabel}</div>
            <p style={{ fontSize:14, color:p.id==="sub"?C.border:C.muted, marginBottom:24, lineHeight:1.6 }}>{p.desc}</p>
            <button onClick={()=>setView("submit")} style={{ width:"100%", background:p.id==="sub"?C.rust:C.ink, color:C.white, border:"none", padding:"11px", borderRadius:8, fontSize:14, fontWeight:600 }}>Get started →</button>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:24, background:C.goldLight, border:`1px solid ${C.gold}`, borderRadius:10, padding:"18px 24px", display:"flex", alignItems:"center", gap:16 }}>
        <span style={{ fontSize:24 }}>★</span>
        <div><div style={{ fontWeight:600, marginBottom:2 }}>Tips always welcome</div><div style={{ color:C.muted, fontSize:13 }}>After receiving a reply, leave a tip to show appreciation — entirely optional.</div></div>
      </div>
      <BannerAd />
    </div>
  );
}

// ─── Submit ────────────────────────────────────────────────────────────────────
function SubmitView({ currentUser, data, setData, setView }) {
  const [step, setStep] = useState("form");
  const [form, setForm] = useState({ name:currentUser?.name||"", email:currentUser?.email||"", anonymous:!currentUser, isPublic:true, subject:"", body:"", plan:"free" });
  const [pendingId, setPendingId] = useState(null);

  function handleContinue() {
    if (!form.subject.trim()||!form.body.trim()) return;
    if (form.plan==="free") { submit(false); } else { const id=genId(); setPendingId(id); setStep("pay"); }
  }
  async function submit(paid) {
    const id=pendingId||genId();
    const sub = { id, userId:currentUser?.id||null, name:form.anonymous?"Anonymous":(form.name.trim()||"Anonymous"), email:form.anonymous?"":form.email.trim(), subject:form.subject.trim(), body:form.body.trim(), isPublic:form.isPublic, anonymous:form.anonymous, plan:form.plan, paid, status:"new", createdAt:Date.now(), reply:null, repliedAt:null, tipped:false };
    const rev = paid ? [{ id:genId(), type:form.plan==="sub"?"subscription":"pay_per_reply", amount:PLANS[form.plan].price*100, submissionId:id, at:Date.now() }, ...data.revenue] : data.revenue;
    await saveSubmission(sub);
    setData(d => ({ ...d, submissions:[sub,...d.submissions] }));
    setStep("done");
  }

  if (step==="pay") return <PaymentModal amount={PLANS[form.plan].price} label={`${PLANS[form.plan].label} — "${form.subject}"`} onSuccess={()=>submit(true)} onCancel={()=>setStep("form")} />;
  if (step==="done") return (
    <div style={{ maxWidth:520, margin:"80px auto", padding:"0 24px", textAlign:"center" }}>
      <div style={{ fontSize:48, marginBottom:20 }}>✉️</div>
      <h2 className="display" style={{ fontSize:28, marginBottom:12 }}>It's been received.</h2>
      <p style={{ color:C.muted, marginBottom:32 }}>{form.plan!=="free"?"Your paid submission is in the priority queue.":"Your submission is in. Replies aren't guaranteed on the free tier."}{form.email?` We'll email ${form.email} when there's a reply.`:""}</p>
      <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
        <button onClick={()=>{setStep("form");setForm(f=>({...f,subject:"",body:""}));}} style={{ background:"none", border:`1.5px solid ${C.border}`, padding:"10px 20px", borderRadius:8, fontSize:14 }}>Submit another</button>
        <button onClick={()=>setView("browse")} style={{ background:C.ink, color:C.white, border:"none", padding:"10px 20px", borderRadius:8, fontSize:14 }}>Browse public threads</button>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:600, margin:"0 auto", padding:"48px 24px" }}>
      <h2 className="display" style={{ fontSize:30, marginBottom:8 }}>Share a problem</h2>
      <p style={{ color:C.muted, marginBottom:32 }}>It'll be read carefully.</p>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        {[["true","Post anonymously"],["false","Use my name"]].map(([v,l])=>(
          <label key={v} style={{ flex:1, display:"flex", alignItems:"center", gap:10, background:(String(form.anonymous)===v)?C.ink:C.cream, color:(String(form.anonymous)===v)?C.white:C.ink, padding:"12px 16px", borderRadius:8, cursor:"pointer", border:`1.5px solid ${(String(form.anonymous)===v)?C.ink:C.border}` }}>
            <input type="radio" checked={String(form.anonymous)===v} onChange={()=>setForm(f=>({...f,anonymous:v==="true"}))} style={{ accentColor:C.rust }} />
            <span style={{ fontWeight:500, fontSize:14 }}>{l}</span>
          </label>
        ))}
      </div>
      {!form.anonymous && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
          <div><label style={lbl}>Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Your name" style={inp} /></div>
          <div><label style={lbl}>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="your@email.com" type="email" style={inp} /></div>
        </div>
      )}
      <div style={{ marginBottom:16 }}><label style={lbl}>Subject</label><input value={form.subject} onChange={e=>setForm(f=>({...f,subject:e.target.value}))} placeholder="Give your problem a short title" style={inp} /></div>
      <div style={{ marginBottom:24 }}><label style={lbl}>What's going on?</label><textarea value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} placeholder="Write as much or as little as you'd like." rows={6} style={{ ...inp, resize:"vertical", lineHeight:1.7 }} /></div>
      <div style={{ marginBottom:20 }}>
        <label style={lbl}>How would you like to submit?</label>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {Object.values(PLANS).map(p=>(
            <label key={p.id} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 16px", borderRadius:9, cursor:"pointer", border:`1.5px solid ${form.plan===p.id?(p.id==="sub"?C.gold:C.rust):C.border}`, background:form.plan===p.id?(p.id==="sub"?C.goldLight:C.rustLight):C.white }}>
              <input type="radio" checked={form.plan===p.id} onChange={()=>setForm(f=>({...f,plan:p.id}))} style={{ accentColor:C.rust, width:16, height:16 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{p.label} <span style={{ fontWeight:700, color:p.id==="free"?C.muted:C.rust }}>{p.priceLabel}</span>{p.badge&&<span style={{ marginLeft:8, background:p.id==="sub"?C.gold:C.rust, color:C.white, fontSize:10, padding:"2px 8px", borderRadius:20, fontWeight:700 }}>{p.badge}</span>}</div>
                <div style={{ color:C.muted, fontSize:13 }}>{p.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:C.cream, padding:"14px 18px", borderRadius:8, marginBottom:28, gap:12 }}>
        <div><div style={{ fontWeight:600, fontSize:14 }}>{form.isPublic?"Visible to everyone":"Only you and me"}</div><div style={{ color:C.muted, fontSize:12 }}>{form.isPublic?"Others can read your thread.":"Stays private."}</div></div>
        <button onClick={()=>setForm(f=>({...f,isPublic:!f.isPublic}))} style={{ background:form.isPublic?C.sage:C.muted, color:C.white, border:"none", padding:"8px 16px", borderRadius:6, fontSize:13, fontWeight:500, whiteSpace:"nowrap" }}>{form.isPublic?"🌐 Public":"🔒 Private"}</button>
      </div>
      <button onClick={handleContinue} disabled={!form.subject.trim()||!form.body.trim()} style={{ background:C.rust, color:C.white, border:"none", padding:"14px 32px", borderRadius:8, fontSize:15, fontWeight:600, opacity:(!form.subject.trim()||!form.body.trim())?0.5:1 }}>
        {form.plan==="free"?"Send it →":`Pay ${PLANS[form.plan].priceLabel} & Send →`}
      </button>
    </div>
  );
}

// ─── Thread Card ───────────────────────────────────────────────────────────────
function ThreadCard({ s, data, setData, showTip }) {
  const [open, setOpen] = useState(false);
  const [tipDone, setTipDone] = useState(s.tipped);
  const [showTipModal, setShowTipModal] = useState(false);
  function handleTipSuccess() {
    setShowTipModal(false); setTipDone(true);
    if (!setData) return;
    const rev = [{ id:genId(), type:"tip", amount:500, submissionId:s.id, at:Date.now() }, ...(data?.revenue||[])];
    const subs = (data?.submissions||[]).map(x=>x.id===s.id?{...x,tipped:true}:x);
    const updated = { ...data, submissions:subs, revenue:rev };
    setData(updated); 
  }
  return (
    <>
      {showTipModal && <TipModal submission={s} onSuccess={handleTipSuccess} onCancel={()=>setShowTipModal(false)} />}
      <div style={{ background:C.white, borderRadius:10, border:`1.5px solid ${C.border}`, overflow:"hidden" }}>
        <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", background:"none", border:"none", padding:"18px 20px", textAlign:"left", cursor:"pointer", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, marginBottom:4 }}>{s.subject}</div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <span style={{ color:C.muted, fontSize:12 }}>by {s.name}</span>
              <span style={{ color:C.muted, fontSize:12 }}>· {timeAgo(s.createdAt)}</span>
              <StatusBadge status={s.status} />
              <PlanBadge plan={s.plan} />
            </div>
          </div>
          <span style={{ color:C.muted, fontSize:16, marginTop:2 }}>{open?"▲":"▼"}</span>
        </button>
        {open && (
          <div style={{ padding:"0 20px 20px", borderTop:`1px solid ${C.cream}` }}>
            <p style={{ marginTop:16, color:"#3a3228", lineHeight:1.75, whiteSpace:"pre-wrap" }}>{s.body}</p>
            {s.reply && (
              <div style={{ marginTop:20, background:C.sageLight, borderLeft:`3px solid ${C.sage}`, padding:"14px 16px", borderRadius:"0 8px 8px 0" }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.sage, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:8 }}>Reply · {timeAgo(s.repliedAt)}</div>
                <p style={{ color:C.ink, lineHeight:1.75, whiteSpace:"pre-wrap" }}>{s.reply}</p>
              </div>
            )}
            {showTip && s.reply && (
              <div style={{ marginTop:16 }}>
                {tipDone ? <span style={{ fontSize:13, color:C.gold, fontWeight:600 }}>★ Thanks for the tip!</span>
                  : <button onClick={()=>setShowTipModal(true)} style={{ background:C.goldLight, color:C.gold, border:`1px solid ${C.gold}`, padding:"7px 16px", borderRadius:8, fontSize:13, fontWeight:600 }}>★ Leave a tip</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Browse ────────────────────────────────────────────────────────────────────
function BrowseView({ data, setData }) {
  const public_ = data.submissions.filter(s=>s.isPublic);
  // Interleave a banner ad every 3 posts
  const items = [];
  public_.forEach((s, i) => {
    items.push({ type:"post", s });
    if ((i+1) % 3 === 0) items.push({ type:"banner" });
  });
  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"48px 24px" }}>
      <h2 className="display" style={{ fontSize:30, marginBottom:8 }}>Public threads</h2>
      <p style={{ color:C.muted, marginBottom:32 }}>{public_.length} problem{public_.length!==1?"s":""} shared</p>
      {public_.length===0
        ? <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}><div style={{ fontSize:36, marginBottom:12 }}>📬</div><p>No public submissions yet.</p></div>
        : <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {items.map((item, i) =>
              item.type==="post"
                ? <ThreadCard key={item.s.id} s={item.s} data={data} setData={setData} showTip />
                : <BannerAd key={`banner-${i}`} />
            )}
          </div>
      }
    </div>
  );
}

// ─── My Submissions ────────────────────────────────────────────────────────────
function MyView({ currentUser, data, setData }) {
  const mine = data.submissions.filter(s=>s.userId===currentUser.id);
  return (
    <div style={{ maxWidth:680, margin:"0 auto", padding:"48px 24px" }}>
      <h2 className="display" style={{ fontSize:30, marginBottom:8 }}>My Submissions</h2>
      <p style={{ color:C.muted, marginBottom:32 }}>{mine.length} submitted</p>
      {mine.length===0 ? <p style={{ color:C.muted }}>Nothing submitted yet.</p>
        : <div style={{ display:"flex", flexDirection:"column", gap:16 }}>{mine.map(s=><ThreadCard key={s.id} s={s} data={data} setData={setData} showTip />)}</div>}
    </div>
  );
}

// ─── Login ─────────────────────────────────────────────────────────────────────
function LoginView({ data, setData, setCurrentUser, setView }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name:"", email:"", password:"" });
  const [err, setErr] = useState("");
  function submit() {
    setErr("");
    if (mode==="register") {
      if (!form.name.trim()||!form.email.trim()||!form.password.trim()) { setErr("All fields required."); return; }
      if (data.users.find(u=>u.email===form.email)) { setErr("Email already registered."); return; }
      const user = { id:genId(), name:form.name.trim(), email:form.email.trim(), password:form.password };
      const updated = { ...data, users:[...data.users, user] };
      setData(updated);  setCurrentUser(user); setView("home");
    } else {
      const user = data.users.find(u=>u.email===form.email&&u.password===form.password);
      if (!user) { setErr("Wrong email or password."); return; }
      setCurrentUser(user); setView("home");
    }
  }
  return (
    <div style={{ maxWidth:400, margin:"80px auto", padding:"0 24px" }}>
      <h2 className="display" style={{ fontSize:28, marginBottom:4 }}>{mode==="login"?"Welcome back":"Create an account"}</h2>
      <p style={{ color:C.muted, marginBottom:32, fontSize:14 }}>{mode==="login"?"Sign in to track your submissions.":"Set up an account to track your submissions."}</p>
      {mode==="register"&&<div style={{ marginBottom:14 }}><label style={lbl}>Name</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} placeholder="Your name" /></div>}
      <div style={{ marginBottom:14 }}><label style={lbl}>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={inp} placeholder="your@email.com" type="email" /></div>
      <div style={{ marginBottom:20 }}><label style={lbl}>Password</label><input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={inp} placeholder="••••••••" type="password" /></div>
      {err&&<p style={{ color:C.rust, fontSize:13, marginBottom:14 }}>{err}</p>}
      <button onClick={submit} style={{ background:C.ink, color:C.white, border:"none", padding:"12px 28px", borderRadius:8, fontSize:15, fontWeight:600, width:"100%" }}>{mode==="login"?"Sign in":"Create account"}</button>
      <p style={{ marginTop:20, fontSize:13, color:C.muted, textAlign:"center" }}>
        {mode==="login"?"No account? ":"Already have one? "}
        <button onClick={()=>setMode(mode==="login"?"register":"login")} style={{ background:"none", border:"none", color:C.rust, fontWeight:600, fontSize:13 }}>{mode==="login"?"Register":"Sign in"}</button>
      </p>
    </div>
  );
}

// ─── Admin ─────────────────────────────────────────────────────────────────────
function AdminView({ data, setData }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const [tab, setTab] = useState("inbox");
  const [filter, setFilter] = useState("all");
  const [replyDraft, setReplyDraft] = useState({});
  const [sending, setSending] = useState({});

  if (!authed) return (
    <div style={{ maxWidth:360, margin:"80px auto", padding:"0 24px" }}>
      <h2 className="display" style={{ fontSize:28, marginBottom:24 }}>Admin Access</h2>
      <input value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder="Password" style={{ ...inp, marginBottom:12 }} onKeyDown={e=>e.key==="Enter"&&(pw===ADMIN_PASSWORD?setAuthed(true):setErr("Wrong password."))} />
      {err&&<p style={{ color:C.rust, fontSize:13, marginBottom:12 }}>{err}</p>}
      <button onClick={()=>pw===ADMIN_PASSWORD?setAuthed(true):setErr("Wrong password.")} style={{ background:C.ink, color:C.white, border:"none", padding:"12px", borderRadius:8, fontSize:15, fontWeight:600, width:"100%" }}>Enter</button>
      <p style={{ color:C.muted, fontSize:12, marginTop:12 }}>Demo password: admin123</p>
    </div>
  );

  const totalRevenue = data.revenue.reduce((a,r)=>a+r.amount, 0);
  const revenueByType = data.revenue.reduce((a,r)=>({...a,[r.type]:(a[r.type]||0)+r.amount}),{});
  const adViews = data.revenue.filter(r=>r.type==="ad_view").length;

  const counts = { all:data.submissions.length, new:data.submissions.filter(s=>s.status==="new").length, replied:data.submissions.filter(s=>s.status==="replied").length };
  const visible = filter==="all"?data.submissions:data.submissions.filter(s=>s.status===filter);

  function sendReply(id) {
    const text=replyDraft[id]?.trim(); if (!text) return;
    setSending(s=>({...s,[id]:true}));
    setTimeout(()=>{
      const updated={...data,submissions:data.submissions.map(s=>s.id===id?{...s,reply:text,status:"replied",repliedAt:Date.now()}:s)};
      setData(updated);  setReplyDraft(d=>({...d,[id]:""})); setSending(s=>({...s,[id]:false}));
    },400);
  }
  function del(id) { const u={...data,submissions:data.submissions.filter(s=>s.id!==id)}; setData(u); saveData(u); }

  return (
    <div style={{ maxWidth:860, margin:"0 auto", padding:"48px 24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
        <h2 className="display" style={{ fontSize:30 }}>Admin Dashboard</h2>
        <button onClick={()=>setAuthed(false)} style={{ background:"none", border:`1px solid ${C.border}`, color:C.muted, padding:"7px 14px", borderRadius:6, fontSize:13 }}>Lock</button>
      </div>
      <div style={{ display:"flex", gap:4, marginBottom:32, borderBottom:`1px solid ${C.border}` }}>
        {[["inbox","Inbox"],["revenue","Revenue"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)} style={{ background:"none", border:"none", borderBottom:`2px solid ${tab===v?C.rust:"transparent"}`, color:tab===v?C.rust:C.muted, padding:"8px 20px", fontSize:14, fontWeight:600, marginBottom:-1 }}>{l}</button>
        ))}
      </div>

      {tab==="revenue" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:14, marginBottom:32 }}>
            {[
              { label:"Total earned",    value:fmtMoney(totalRevenue),                      color:C.sage },
              { label:"Pay-per-reply",   value:fmtMoney(revenueByType.pay_per_reply||0),    color:C.rust },
              { label:"Subscriptions",   value:fmtMoney(revenueByType.subscription||0),     color:C.gold },
              { label:"Tips",            value:fmtMoney(revenueByType.tip||0),              color:"#7a5a9a" },
              { label:"Ad revenue",      value:fmtMoney(revenueByType.ad_view||0), sub:`${adViews} views`, color:"#2d7a8a" },
            ].map(({label,value,color,sub})=>(
              <div key={label} style={{ background:C.white, border:`1.5px solid ${C.border}`, borderRadius:10, padding:"16px 18px", borderTop:`3px solid ${color}` }}>
                <div style={{ color:C.muted, fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>{label}</div>
                <div className="display" style={{ fontSize:22, fontWeight:700 }}>{value}</div>
                {sub && <div style={{ color:C.muted, fontSize:11, marginTop:2 }}>{sub}</div>}
              </div>
            ))}
          </div>
          <div style={{ background:C.white, border:`1.5px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px", borderBottom:`1px solid ${C.cream}`, fontWeight:600, fontSize:14 }}>Transaction log</div>
            {data.revenue.length===0
              ? <div style={{ padding:"40px", textAlign:"center", color:C.muted }}>No transactions yet.</div>
              : data.revenue.map(r=>(
                <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 20px", borderBottom:`1px solid ${C.cream}` }}>
                  <div>
                    <span style={{ fontWeight:500, fontSize:14, textTransform:"capitalize" }}>{r.type.replace(/_/g," ")}</span>
                    {r.brand && <span style={{ color:C.muted, fontSize:12, marginLeft:8 }}>· {r.brand}</span>}
                    <span style={{ color:C.muted, fontSize:12, marginLeft:8 }}>· {timeAgo(r.at)}</span>
                  </div>
                  <span style={{ fontWeight:700, color:C.sage }}>{fmtMoney(r.amount)}</span>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {tab==="inbox" && (
        <>
          <div style={{ display:"flex", gap:8, marginBottom:24 }}>
            {["all","new","replied"].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?C.ink:C.cream, color:filter===f?C.white:C.ink, border:"none", padding:"8px 18px", borderRadius:6, fontSize:13, fontWeight:500, textTransform:"capitalize" }}>{f} {counts[f]>0?`(${counts[f]})`:""}
              </button>
            ))}
          </div>
          {visible.length===0
            ? <div style={{ textAlign:"center", padding:"60px 0", color:C.muted }}><div style={{ fontSize:36, marginBottom:12 }}>📭</div><p>Nothing here.</p></div>
            : <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                {visible.map(s=>(
                  <div key={s.id} style={{ background:C.white, borderRadius:10, border:`1.5px solid ${s.status==="new"?C.rust:C.border}`, overflow:"hidden" }}>
                    <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.cream}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{s.subject}</div>
                          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                            <span style={{ color:C.muted, fontSize:12 }}>{s.anonymous?"Anonymous":s.name}{s.email?` · ${s.email}`:""}</span>
                            <span style={{ color:C.muted, fontSize:12 }}>· {timeAgo(s.createdAt)}</span>
                            <StatusBadge status={s.status} />
                            <PlanBadge plan={s.plan} />
                            <span style={{ fontSize:11, color:C.muted, background:C.cream, padding:"2px 8px", borderRadius:12 }}>{s.isPublic?"🌐 Public":"🔒 Private"}</span>
                            {s.tipped && <span style={{ fontSize:11, color:C.gold, fontWeight:700 }}>★ Tipped</span>}
                          </div>
                        </div>
                        <button onClick={()=>del(s.id)} style={{ background:"none", border:"none", color:"#ccc", fontSize:18, padding:"2px 6px", flexShrink:0 }}>×</button>
                      </div>
                    </div>
                    <div style={{ padding:"16px 20px" }}>
                      <p style={{ color:"#3a3228", lineHeight:1.75, whiteSpace:"pre-wrap", marginBottom:20 }}>{s.body}</p>
                      {s.reply && (
                        <div style={{ background:C.sageLight, borderLeft:`3px solid ${C.sage}`, padding:"12px 16px", borderRadius:"0 8px 8px 0", marginBottom:16 }}>
                          <div style={{ fontSize:11, fontWeight:700, color:C.sage, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Your reply · {timeAgo(s.repliedAt)}</div>
                          <p style={{ color:C.ink, lineHeight:1.75, whiteSpace:"pre-wrap" }}>{s.reply}</p>
                        </div>
                      )}
                      <div style={{ display:"flex", gap:10, alignItems:"flex-end" }}>
                        <textarea value={replyDraft[s.id]||""} onChange={e=>setReplyDraft(d=>({...d,[s.id]:e.target.value}))} placeholder={s.reply?"Update reply…":"Write your reply…"} rows={3} style={{ ...inp, flex:1, resize:"vertical", lineHeight:1.65, fontSize:14 }} />
                        <button onClick={()=>sendReply(s.id)} disabled={!replyDraft[s.id]?.trim()||sending[s.id]} style={{ background:C.sage, color:C.white, border:"none", padding:"10px 18px", borderRadius:8, fontSize:13, fontWeight:600, flexShrink:0, opacity:!replyDraft[s.id]?.trim()?0.5:1 }}>
                          {sending[s.id]?"Sending…":s.reply?"Update":"Send Reply"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>
      )}
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [currentUser, setCurrentUser] = useState(null);
  const [data, setData] = useState({ submissions:[], users:[], revenue:[] });
  const [showAd, setShowAd] = useState(false);

  useEffect(() => {
    loadSubmissions().then(submissions => {
      setData(d => ({ ...d, submissions }))
    })
  }, []);

  // Show ad on return visits (not first ever visit)
  useEffect(() => {
    const last = localStorage.getItem(LAST_VISIT_KEY);
    const now = Date.now();
    // Show ad if returning after more than 30 seconds away
    if (last && now - parseInt(last) > 30000) {
      setShowAd(true);
    }
    localStorage.setItem(LAST_VISIT_KEY, String(now));
    // Update last visit timestamp on unload
    const handleUnload = () => localStorage.setItem(LAST_VISIT_KEY, String(Date.now()));
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  return (
    <>
      <style>{gs}</style>
      {showAd && <EntryAd onClose={()=>setShowAd(false)} data={data} setData={setData} />}
      <div style={{ minHeight:"100vh", background:C.parchment }}>
        <Nav view={view} setView={setView} currentUser={currentUser} setCurrentUser={setCurrentUser} />
        <main>
          {view==="home"    && <HomeView setView={setView} />}
          {view==="pricing" && <PricingView setView={setView} />}
          {view==="submit"  && <SubmitView currentUser={currentUser} data={data} setData={setData} setView={setView} />}
          {view==="browse"  && <BrowseView data={data} setData={setData} />}
          {view==="my"      && currentUser && <MyView currentUser={currentUser} data={data} setData={setData} />}
          {view==="login"   && <LoginView data={data} setData={setData} setCurrentUser={setCurrentUser} setView={setView} />}
          {view==="admin"   && <AdminView data={data} setData={setData} />}
        </main>
      </div>
    </>
  );
}
