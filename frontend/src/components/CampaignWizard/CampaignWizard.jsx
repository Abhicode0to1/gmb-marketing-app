import { useState } from "react";
import { ChevronRight, ChevronLeft, X, Sparkles, Loader, RefreshCw, CheckCircle } from "lucide-react";
import { generateTemplates } from "../../api";

const STEPS = ["Basic Info", "Target Audience", "AI Generate", "Email Template", "WhatsApp Message", "Follow-ups", "Review & Save"];

const TONES = ["friendly", "professional", "urgent", "excited", "empathetic"];
const LANGUAGES = ["English", "Hindi", "Hinglish (Hindi + English)", "Marathi", "Tamil", "Telugu", "Gujarati", "Bengali"];

const FALLBACK_EMAIL = `<p>Hi <strong>{business_name}</strong>,</p>
<p>We help local businesses in {city} grow online with professional websites. Interested in a free consultation?</p>
<p>Best regards,<br/>Your Web Design Team</p>`;

const FALLBACK_WA = `Hi {business_name}! We help businesses in {city} get more customers with professional websites. Interested? Reply YES for a free consultation!`;

export default function CampaignWizard({ onSave, onCancel }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: "",
    type: "BOTH",
    target_filters: { city: "", category: "", min_score: 50, no_website_only: false },
    email_subject: "",
    email_template_html: FALLBACK_EMAIL,
    whatsapp_template: FALLBACK_WA,
    follow_up_days: [1, 3, 7],
  });

  // AI generator state
  const [aiForm, setAiForm] = useState({
    business_category: "",
    city: "",
    service_offered: "professional website design",
    tone: "friendly",
    language: "English",
    extra_offer: "",
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiApplied, setAiApplied] = useState(false);

  const update = (key, value) => setData((p) => ({ ...p, [key]: value }));
  const updateFilter = (key, value) =>
    setData((p) => ({ ...p, target_filters: { ...p.target_filters, [key]: value } }));

  const handleGenerate = async () => {
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    setAiApplied(false);
    try {
      const res = await generateTemplates({
        ...aiForm,
        city: aiForm.city || data.target_filters.city || "your city",
        business_category: aiForm.business_category || data.target_filters.category || "local business",
      });
      setAiResult(res.data);
    } catch (e) {
      setAiError(e.response?.data?.detail || "Generation failed. Check your Anthropic API key.");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiTemplates = () => {
    if (!aiResult) return;
    setData((p) => ({
      ...p,
      email_subject: aiResult.email_subject || p.email_subject,
      email_template_html: aiResult.email_html || p.email_template_html,
      whatsapp_template: aiResult.whatsapp_message || p.whatsapp_template,
    }));
    setAiApplied(true);
  };

  const handleSave = () => {
    const payload = { ...data };
    payload.target_filters = { ...data.target_filters };
    if (!payload.target_filters.city) delete payload.target_filters.city;
    if (!payload.target_filters.category) delete payload.target_filters.category;
    onSave(payload);
  };

  const canNext = () => {
    if (step === 0) return !!data.name;
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Campaign</h2>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-5 py-3 gap-1 border-b border-gray-100 overflow-x-auto">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold cursor-pointer transition-colors ${
                  i < step ? "bg-blue-600 text-white" :
                  i === step ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" :
                  "bg-gray-100 text-gray-400"
                }`}
                onClick={() => i < step && setStep(i)}
              >
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-3 h-0.5 ${i < step ? "bg-blue-400" : "bg-gray-200"}`} />}
            </div>
          ))}
          <span className="ml-3 text-xs text-gray-400 font-medium">{STEPS[step]}</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* Step 0 — Basic Info */}
          {step === 0 && (
            <>
              <div>
                <label className="label">Campaign Name *</label>
                <input className="input" value={data.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Mumbai Restaurants Outreach May 2026" />
              </div>
              <div>
                <label className="label">Outreach Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  {["BOTH", "EMAIL", "WHATSAPP"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update("type", t)}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        data.type === t ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {t === "BOTH" ? "Email + WhatsApp" : t === "EMAIL" ? "Email Only" : "WhatsApp Only"}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 1 — Target Audience */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Target City</label>
                  <input className="input" value={data.target_filters.city} onChange={(e) => updateFilter("city", e.target.value)} placeholder="e.g. Mumbai (blank = all)" />
                </div>
                <div>
                  <label className="label">Business Category</label>
                  <input className="input" value={data.target_filters.category} onChange={(e) => updateFilter("category", e.target.value)} placeholder="e.g. restaurant (blank = all)" />
                </div>
              </div>
              <div>
                <label className="label">Minimum Lead Score: <span className="text-blue-600 font-semibold">{data.target_filters.min_score}</span></label>
                <input className="w-full accent-blue-600" type="range" min={0} max={100} step={5} value={data.target_filters.min_score} onChange={(e) => updateFilter("min_score", +e.target.value)} />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0 — all leads</span><span>100 — hottest only</span></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={data.target_filters.no_website_only} onChange={(e) => updateFilter("no_website_only", e.target.checked)} className="accent-blue-600" />
                Only target businesses <strong>without a website</strong> (highest conversion potential)
              </label>
            </>
          )}

          {/* Step 2 — AI Generate */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                <Sparkles size={18} className="text-purple-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Generate with Claude AI</p>
                  <p className="text-xs text-gray-500">Claude will write a personalized email and WhatsApp template tailored to your target audience.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Business Category</label>
                  <input className="input" value={aiForm.business_category} onChange={(e) => setAiForm((p) => ({ ...p, business_category: e.target.value }))}
                    placeholder={data.target_filters.category || "e.g. restaurant, salon, clinic"} />
                </div>
                <div>
                  <label className="label">City</label>
                  <input className="input" value={aiForm.city} onChange={(e) => setAiForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder={data.target_filters.city || "e.g. Mumbai"} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tone</label>
                  <select className="input" value={aiForm.tone} onChange={(e) => setAiForm((p) => ({ ...p, tone: e.target.value }))}>
                    {TONES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Language</label>
                  <select className="input" value={aiForm.language} onChange={(e) => setAiForm((p) => ({ ...p, language: e.target.value }))}>
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Special Offer (optional)</label>
                <input className="input" value={aiForm.extra_offer} onChange={(e) => setAiForm((p) => ({ ...p, extra_offer: e.target.value }))}
                  placeholder="e.g. Free 3-month SEO, 50% discount, Free logo design" />
              </div>

              <button
                className="btn-primary w-full justify-center"
                onClick={handleGenerate}
                disabled={aiLoading}
              >
                {aiLoading ? <><Loader size={15} className="animate-spin" /> Claude is writing your templates...</> : <><Sparkles size={15} /> Generate Templates with Claude</>}
              </button>

              {aiError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{aiError}</div>
              )}

              {aiResult && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Email Subject</p>
                      <p className="text-sm font-medium text-gray-900 bg-white border border-gray-200 rounded-lg px-3 py-2">{aiResult.email_subject}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Email Preview</p>
                      <div
                        className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 max-h-28 overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: aiResult.email_html?.slice(0, 800) + (aiResult.email_html?.length > 800 ? "..." : "") }}
                      />
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">WhatsApp Preview</p>
                      <p className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap max-h-24 overflow-y-auto">{aiResult.whatsapp_message}</p>
                    </div>

                    {aiResult.reasoning && (
                      <div className="flex items-start gap-2 bg-purple-50 rounded-lg px-3 py-2">
                        <Sparkles size={12} className="text-purple-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-purple-700 italic">{aiResult.reasoning}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button className={`btn flex-1 justify-center text-sm ${aiApplied ? "bg-green-600 text-white" : "btn-primary"}`} onClick={applyAiTemplates} disabled={aiApplied}>
                      {aiApplied ? <><CheckCircle size={14} /> Applied to Campaign</> : "Apply These Templates"}
                    </button>
                    <button className="btn-secondary text-sm" onClick={handleGenerate} disabled={aiLoading}>
                      <RefreshCw size={13} /> Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Email Template */}
          {step === 3 && (
            <>
              <div>
                <label className="label">Email Subject Line</label>
                <input className="input" value={data.email_subject} onChange={(e) => update("email_subject", e.target.value)} placeholder="e.g. Grow your restaurant in Mumbai with a professional website" />
              </div>
              <div>
                <label className="label">Email Body (HTML — tokens: <code className="text-blue-600 text-xs">{"{business_name}"}</code>, <code className="text-blue-600 text-xs">{"{city}"}</code>)</label>
                <textarea className="input font-mono text-xs" rows={14} value={data.email_template_html} onChange={(e) => update("email_template_html", e.target.value)} />
              </div>
            </>
          )}

          {/* Step 4 — WhatsApp */}
          {step === 4 && (
            <div>
              <label className="label">WhatsApp Message (tokens: <code className="text-blue-600 text-xs">{"{business_name}"}</code>, <code className="text-blue-600 text-xs">{"{city}"}</code>)</label>
              <textarea className="input" rows={12} value={data.whatsapp_template} onChange={(e) => update("whatsapp_template", e.target.value)} />
              <p className={`text-xs mt-1 ${data.whatsapp_template.length > 900 ? "text-red-500" : "text-gray-400"}`}>
                {data.whatsapp_template.length} / 1024 characters
              </p>
            </div>
          )}

          {/* Step 5 — Follow-ups */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <label className="label">Follow-up Days (comma-separated)</label>
                <input
                  className="input"
                  value={data.follow_up_days.join(",")}
                  onChange={(e) => {
                    const days = e.target.value.split(",").map((d) => parseInt(d.trim())).filter((d) => !isNaN(d) && d > 0);
                    update("follow_up_days", days);
                  }}
                />
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
                <p className="font-semibold">Outreach sequence preview:</p>
                <p>Day 0 → Initial email + WhatsApp sent</p>
                {data.follow_up_days.map((d, i) => (
                  <p key={d}>Day {d} → Follow-up #{i + 1} (if no reply)</p>
                ))}
                <p className="text-blue-500 text-xs mt-2">If lead replies at any point → moved to "Interested" + sales team notified</p>
              </div>
            </div>
          )}

          {/* Step 6 — Review */}
          {step === 6 && (
            <div className="space-y-3">
              {aiApplied && (
                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 text-sm text-purple-700">
                  <Sparkles size={14} />
                  Templates generated by Claude AI applied
                </div>
              )}
              <div className="card p-4 bg-gray-50 text-sm space-y-2.5">
                {[
                  ["Campaign Name", data.name],
                  ["Channel", data.type],
                  ["City", data.target_filters.city || "All"],
                  ["Category", data.target_filters.category || "All"],
                  ["Min Lead Score", data.target_filters.min_score],
                  ["No-website only", data.target_filters.no_website_only ? "Yes" : "No"],
                  ["Email Subject", data.email_subject || "(none)"],
                  ["Follow-ups", `Day ${data.follow_up_days.join(", ")}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-gray-500 flex-shrink-0">{k}</span>
                    <span className="font-medium text-gray-900 text-right truncate">{String(v)}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500">Saved as <strong>draft</strong> — launch it from the Campaigns page when ready.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <button className="btn-secondary" onClick={() => step === 0 ? onCancel() : setStep((s) => s - 1)}>
            <ChevronLeft size={15} /> {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button className="btn-primary" onClick={handleSave} disabled={!data.name}>
              Save Campaign
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
