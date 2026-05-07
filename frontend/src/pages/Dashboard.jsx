import { useEffect, useState } from "react";
import { Users, Mail, MessageSquare, TrendingUp, Phone, Globe } from "lucide-react";
import { getOverview, getPipelineStats } from "../api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PIPELINE_COLORS = {
  new: "#93c5fd",
  contacted: "#fbbf24",
  interested: "#34d399",
  negotiating: "#a78bfa",
  converted: "#10b981",
  lost: "#f87171",
};

function StatCard({ icon: Icon, label, value, sub, color = "blue" }) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [pipeline, setPipeline] = useState(null);

  useEffect(() => {
    getOverview().then((r) => setOverview(r.data));
    getPipelineStats().then((r) => setPipeline(r.data));
  }, []);

  const pipelineData = pipeline
    ? Object.entries(pipeline).map(([name, count]) => ({ name, count }))
    : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 text-sm">Overview of your GMB marketing pipeline</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={overview?.total_leads} color="blue" />
        <StatCard icon={Phone} label="Contacted" value={overview?.contacted} color="yellow" />
        <StatCard icon={TrendingUp} label="Interested" value={overview?.interested} color="purple" />
        <StatCard
          icon={Globe}
          label="Converted"
          value={overview?.converted}
          sub={`${overview?.conversion_rate ?? 0}% rate`}
          color="green"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          icon={Mail}
          label="Emails Sent"
          value={overview?.total_emails_sent}
          sub={`${overview?.email_open_rate ?? 0}% open rate`}
          color="blue"
        />
        <StatCard icon={MessageSquare} label="WhatsApp Sent" value={overview?.total_whatsapp_sent} color="green" />
      </div>

      {pipelineData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Lead Pipeline</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pipelineData} barSize={40}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {pipelineData.map((entry) => (
                  <Cell key={entry.name} fill={PIPELINE_COLORS[entry.name] || "#93c5fd"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
