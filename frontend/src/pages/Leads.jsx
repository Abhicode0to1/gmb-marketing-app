import { useEffect, useState } from "react";
import { Search, Globe, Phone, Mail, Star, AlertTriangle, Download } from "lucide-react";
import { getLeads, updateLead } from "../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STATUS_COLORS = {
  new: "bg-gray-100 text-gray-600",
  contacted: "bg-yellow-100 text-yellow-700",
  interested: "bg-green-100 text-green-700",
  negotiating: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-600",
};

const STATUSES = ["new", "contacted", "interested", "negotiating", "converted", "lost"];

const SERVICE_NEED_CFG = {
  new_website: { label: "No Site", color: "bg-orange-100 text-orange-700", icon: Globe },
  redesign: { label: "Redesign", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  corporate_email: { label: "No Corp Email", color: "bg-purple-100 text-purple-700", icon: Mail },
};

const WEBSITE_STATUS_CFG = {
  none: { label: "No website", color: "bg-orange-100 text-orange-600" },
  social_only: { label: "Social only", color: "bg-yellow-100 text-yellow-700" },
  broken: { label: "Broken", color: "bg-red-100 text-red-700" },
  old: { label: "Outdated", color: "bg-amber-100 text-amber-700" },
  alive: { label: "Live", color: "bg-green-100 text-green-700" },
};

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: "",
    city: "",
    search: "",
    no_website_only: false,
    min_score: "",
    website_status: "",
    service_needs: "",
    has_email: false,
  });
  const [loading, setLoading] = useState(false);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 25, ...filters };
      if (!params.status) delete params.status;
      if (!params.city) delete params.city;
      if (!params.search) delete params.search;
      if (!params.min_score) delete params.min_score;
      if (!params.website_status) delete params.website_status;
      if (!params.service_needs) delete params.service_needs;
      if (!params.has_email) delete params.has_email;
      const res = await getLeads(params);
      setLeads(res.data.leads);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [page, filters]);

  const handleStatusChange = async (leadId, newStatus) => {
    await updateLead(leadId, { status: newStatus });
    fetchLeads();
  };

  const handleExport = () => {
    const token = localStorage.getItem("token");
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.city) params.set("city", filters.city);
    if (filters.search) params.set("search", filters.search);
    if (filters.min_score) params.set("min_score", filters.min_score);
    if (filters.website_status) params.set("website_status", filters.website_status);
    if (filters.service_needs) params.set("service_needs", filters.service_needs);
    if (filters.no_website_only) params.set("no_website_only", "true");
    if (filters.has_email) params.set("has_email", "true");
    params.set("token", token);
    window.open(`${API_BASE}/leads/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Leads</h2>
          <p className="text-gray-500 text-sm">{total} total leads</p>
        </div>
        <button className="btn-secondary flex items-center gap-2" onClick={handleExport}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input pl-8"
            placeholder="Search business name..."
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
          />
        </div>
        <select
          className="input w-36"
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
        >
          <option value="">All status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          className="input w-32"
          placeholder="City"
          value={filters.city}
          onChange={(e) => setFilters((p) => ({ ...p, city: e.target.value }))}
        />
        <input
          className="input w-28"
          type="number"
          placeholder="Min score"
          value={filters.min_score}
          onChange={(e) => setFilters((p) => ({ ...p, min_score: e.target.value }))}
        />
        <select
          className="input w-40"
          value={filters.website_status}
          onChange={(e) => setFilters((p) => ({ ...p, website_status: e.target.value }))}
        >
          <option value="">All site status</option>
          <option value="none">No website</option>
          <option value="social_only">Social only</option>
          <option value="broken">Broken site</option>
          <option value="old">Outdated site</option>
          <option value="alive">Live site</option>
        </select>
        <select
          className="input w-44"
          value={filters.service_needs}
          onChange={(e) => setFilters((p) => ({ ...p, service_needs: e.target.value }))}
        >
          <option value="">All service needs</option>
          <option value="new_website">Needs new website</option>
          <option value="redesign">Needs redesign</option>
          <option value="corporate_email">Needs corp email</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={filters.has_email}
            onChange={(e) => setFilters((p) => ({ ...p, has_email: e.target.checked }))}
          />
          <Mail size={13} /> Has email
        </label>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Business</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Contact</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Needs</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Score</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No leads found</td></tr>
              ) : leads.map((lead) => {
                const wsCfg = lead.website_status ? WEBSITE_STATUS_CFG[lead.website_status] : null;
                return (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{lead.business_name}</div>
                      <div className="text-xs text-gray-400">{lead.city} · {lead.category}</div>
                      {wsCfg && (
                        <span className={`badge mt-1 ${wsCfg.color}`}>{wsCfg.label}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 space-y-0.5">
                      {lead.phone && <div className="flex items-center gap-1.5 text-gray-600"><Phone size={12} />{lead.phone}</div>}
                      {lead.email && <div className="flex items-center gap-1.5 text-gray-600"><Mail size={12} />{lead.email}</div>}
                      {lead.website && <div className="flex items-center gap-1.5 text-blue-500"><Globe size={12} /><a href={lead.website} target="_blank" rel="noreferrer" className="underline">Website</a></div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(lead.service_needs || []).map((need) => {
                          const cfg = SERVICE_NEED_CFG[need];
                          if (!cfg) return null;
                          const Icon = cfg.icon;
                          return (
                            <span key={need} className={`badge ${cfg.color} flex items-center gap-1`}>
                              <Icon size={10} /> {cfg.label}
                            </span>
                          );
                        })}
                        {(!lead.service_needs || lead.service_needs.length === 0) && (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        lead.lead_score >= 70 ? "bg-green-100 text-green-700" :
                        lead.lead_score >= 40 ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>
                        {lead.lead_score}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className={`badge cursor-pointer border-0 ${STATUS_COLORS[lead.status]} py-1`}
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {lead.rating ? (
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Star size={12} fill="currentColor" />
                          <span className="text-gray-700 text-xs">{lead.rating} ({lead.review_count})</span>
                        </div>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">Page {page}</span>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <button className="btn-secondary text-xs" disabled={leads.length < 25} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
