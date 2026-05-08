import { useState } from "react";
import { Search, CheckCircle, Loader } from "lucide-react";
import { startExtraction } from "../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Extractor() {
  const [form, setForm] = useState({ keyword: "", city: "", radius_km: 10, max_results: 100 });
  const [jobId, setJobId] = useState(null);
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
    setJobId(id);

    const token = localStorage.getItem("token");
    const es = new EventSource(
      `${API_BASE}/leads/extract/progress/${id}?token=${token}`
    );

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
      if (data.lead_name) {
        setLog((prev) => [
          { name: data.lead_name, score: data.lead_score, status: data.status },
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

  const pct = progress && progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">GMB Extractor</h2>
        <p className="text-gray-500 text-sm">Bulk extract leads from Google My Business</p>
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
          <button className="btn-primary w-full justify-center" disabled={running}>
            {running ? (
              <><Loader size={16} className="animate-spin" /> Extracting...</>
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
              {done ? "Extraction complete!" : "Extracting leads..."}
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
                  {progress.duplicate_count} duplicates skipped (already in database).
                </div>
              )}
              {progress.new_count === 0 && progress.duplicate_count === 0 && (
                <div className="text-sm text-gray-500">
                  No results returned by Google Places for this query.
                </div>
              )}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {log.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                <span className="text-gray-700">{item.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`badge ${item.score >= 60 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    Score: {item.score}
                  </span>
                  {item.status === "duplicate" && (
                    <span className="badge bg-yellow-100 text-yellow-700">Duplicate</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
