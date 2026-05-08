import { useState } from "react";
import { Search, CheckCircle, Loader, Globe, Mail, AlertTriangle, Clock } from "lucide-react";
import { startExtraction } from "../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const SERVICE_NEED_LABELS = {
  new_website: { label: "No Site", color: "bg-orange-100 text-orange-700", icon: Globe },
  redesign: { label: "Old/Broken", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  corporate_email: { label: "No Corp Email", color: "bg-purple-100 text-purple-700", icon: Mail },
};

const WEBSITE_STATUS_LABELS = {
  none: { label: "No website", color: "bg-orange-100 text-orange-700" },
  social_only: { label: "Social only", color: "bg-yellow-100 text-yellow-700" },
  broken: { label: "Broken site", color: "bg-red-100 text-red-700" },
  old: { label: "Outdated site", color: "bg-amber-100 text-amber-700" },
  alive: { label: "Has website", color: "bg-green-100 text-green-700" },
};

export default function Extractor() {
  const [form, setForm] = useState({
    keyword: "",
    city: "",
    radius_km: 10,
    max_results: 100,
    no_website_only: true,
  });
  const [progress, setProgress] = useState(null);
  const [log, setLog] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setRunning(true);
    setDone(false);
    setLog([]);
    setProgress(null);

    const res = await startExtraction(form);
    const id = res.data.job_id;

    const token = localStorage.getItem("token");
    const es = new EventSource(
      `${API_BASE}/leads/extract/progress/${id}?token=${token}`
    );

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
      if (data.lead_name) {
        setLog((prev) => [
          {
            name: data.lead_name,
            score: data.lead_score,
            status: data.status,
            website_status: data.website_status,
            service_needs: data.service_needs || [],
          },
          ...prev.slice(0, 49),
        ]);
      }
      if (data.done) {
        es.close();
        setRunning(false);
        setDone(true);
      }
    };

    es.onerror = () => {
      es.close();
      setRunning(false);
    };
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">GMB Extractor</h2>
        <p className="text-gray-500 text-sm">
          Find businesses with no website, broken or outdated sites, and no corporate email
        </p>
      </div>

      <div className="card p-5 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Business Category / Keyword</label>
            <input
              className="input"
              required
              value={form.keyword}
              onChange={(e) => setForm((p) => ({ ...p, keyword: e.target.value }))}
              placeholder="e.g. restaurant, salon, dentist"
            />
          </div>
          <div>
            <label className="label">City</label>
            <input
              className="input"
              required
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              placeholder="e.g. Mumbai, Delhi, Bangalore"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Radius (km)</label>
              <input
                className="input"
                type="number"
                min={1}
                max={50}
                value={form.radius_km}
                onChange={(e) => setForm((p) => ({ ...p, radius_km: +e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Max Results</label>
              <input
                className="input"
                type="number"
                min={1}
                max={500}
                value={form.max_results}
                onChange={(e) => setForm((p) => ({ ...p, max_results: +e.target.value }))}
              />
            </div>
          </div>

          {/* Target filter */}
          <label className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-blue-600"
              checked={form.no_website_only}
              onChange={(e) => setForm((p) => ({ ...p, no_website_only: e.target.checked }))}
            />
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                <Globe size={14} />
                Skip businesses with proper websites
              </div>
              <p className="text-xs text-blue-600 mt-0.5">
                Only targets businesses using Facebook/Instagram as their "website" or nothing at all — the best prospects for web design services.
              </p>
            </div>
          </label>

          <button className="btn-primary w-full justify-center" disabled={running}>
            {running ? (
              <><Loader size={16} className="animate-spin" /> Extracting &amp; Analysing...</>
            ) : (
              <><Search size={16} /> Start Extraction</>
            )}
          </button>
        </form>
      </div>

      {progress && (
        <div className="card p-5 max-w-2xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {done ? "Extraction complete!" : "Extracting & analysing leads..."}
            </span>
            <span className="text-sm text-gray-500">
              {progress.processed} / {progress.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          {done && (
            <div className="mb-3 space-y-1">
              <div className="flex items-center gap-2 text-green-600 font-medium">
                <CheckCircle size={18} />
                {progress.new_count > 0
                  ? `Done! ${progress.new_count} new leads added.`
                  : "Done! No new leads found."}
              </div>
              {progress.duplicate_count > 0 && (
                <div className="text-sm text-yellow-600">
                  {progress.duplicate_count} skipped (already in database or has website).
                </div>
              )}
              {progress.new_count === 0 && progress.duplicate_count === 0 && (
                <div className="text-sm text-gray-500">
                  No results from Google Places for this query.
                </div>
              )}
            </div>
          )}

          <div className="max-h-72 overflow-y-auto space-y-1">
            {log.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-700 truncate max-w-[200px]">{item.name}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0 ml-2">
                  <span className={`badge ${item.score >= 60 ? "bg-green-100 text-green-700" : item.score >= 40 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                    {item.score}
                  </span>
                  {item.website_status && WEBSITE_STATUS_LABELS[item.website_status] && (
                    <span className={`badge ${WEBSITE_STATUS_LABELS[item.website_status].color}`}>
                      {WEBSITE_STATUS_LABELS[item.website_status].label}
                    </span>
                  )}
                  {(item.service_needs || []).map((need) => {
                    const cfg = SERVICE_NEED_LABELS[need];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    return (
                      <span key={need} className={`badge ${cfg.color} flex items-center gap-1`}>
                        <Icon size={9} /> {cfg.label}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
