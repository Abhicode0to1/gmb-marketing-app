import { useEffect, useState } from "react";
import { getOverview, getTopCities, getTopCategories } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

function MetricCard({ label, value, sub, highlight }) {
  return (
    <div className={`card p-5 ${highlight ? "border-blue-200 bg-blue-50" : ""}`}>
      <p className="text-3xl font-bold text-gray-900">{value ?? "—"}</p>
      <p className="text-sm font-medium text-gray-600 mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [cities, setCities] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    getOverview().then((r) => setOverview(r.data));
    getTopCities().then((r) => setCities(r.data));
    getTopCategories().then((r) => setCategories(r.data));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
        <p className="text-gray-500 text-sm">Campaign performance and lead insights</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Leads" value={overview?.total_leads} highlight />
        <MetricCard label="Conversion Rate" value={`${overview?.conversion_rate ?? 0}%`} sub="Leads → Customers" />
        <MetricCard label="Email Open Rate" value={`${overview?.email_open_rate ?? 0}%`} sub={`${overview?.total_emails_sent ?? 0} sent`} />
        <MetricCard label="WhatsApp Sent" value={overview?.total_whatsapp_sent} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top cities */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Top Cities</h3>
          {cities.length === 0 ? (
            <p className="text-gray-400 text-sm">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cities} layout="vertical" barSize={16}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="city" type="category" tick={{ fontSize: 11 }} width={80} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {cities.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top categories */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Top Categories</h3>
          {categories.length === 0 ? (
            <p className="text-gray-400 text-sm">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categories} layout="vertical" barSize={16}>
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pipeline funnel */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Sales Funnel</h3>
        <p className="text-xs text-gray-400 mb-4">Lead progression through the pipeline</p>
        <div className="flex gap-2">
          {[
            { label: "Total", value: overview?.total_leads, bg: "bg-gray-200" },
            { label: "Contacted", value: overview?.contacted, bg: "bg-yellow-200" },
            { label: "Interested", value: overview?.interested, bg: "bg-blue-200" },
            { label: "Converted", value: overview?.converted, bg: "bg-green-200" },
          ].map((item) => (
            <div key={item.label} className={`flex-1 ${item.bg} rounded-xl p-4 text-center`}>
              <p className="text-2xl font-bold text-gray-800">{item.value ?? "—"}</p>
              <p className="text-xs text-gray-600 mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
