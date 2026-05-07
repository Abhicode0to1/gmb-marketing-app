import { useEffect, useState } from "react";
import { Plus, Play, Pause, ChevronRight } from "lucide-react";
import { getCampaigns, createCampaign, launchCampaign, pauseCampaign, getAudienceCount } from "../api";
import CampaignWizard from "../components/CampaignWizard/CampaignWizard";

const STATUS_COLORS = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  completed: "bg-blue-100 text-blue-700",
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchCampaigns = async () => {
    setLoading(true);
    const res = await getCampaigns();
    setCampaigns(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleLaunch = async (id) => {
    await launchCampaign(id);
    fetchCampaigns();
  };

  const handlePause = async (id) => {
    await pauseCampaign(id);
    fetchCampaigns();
  };

  const handleCreate = async (data) => {
    await createCampaign(data);
    setShowWizard(false);
    fetchCampaigns();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Campaigns</h2>
          <p className="text-gray-500 text-sm">Manage email and WhatsApp outreach campaigns</p>
        </div>
        <button className="btn-primary" onClick={() => setShowWizard(true)}>
          <Plus size={16} /> New Campaign
        </button>
      </div>

      {showWizard && (
        <CampaignWizard onSave={handleCreate} onCancel={() => setShowWizard(false)} />
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            No campaigns yet. Create your first campaign to start outreach.
          </div>
        ) : campaigns.map((c) => (
          <div key={c.id} className="card p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <span className={`badge ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                <span className="badge bg-blue-50 text-blue-600">{c.type}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1 space-x-3">
                {c.target_filters?.city && <span>City: {c.target_filters.city}</span>}
                {c.target_filters?.category && <span>Category: {c.target_filters.category}</span>}
                {c.target_filters?.min_score && <span>Min score: {c.target_filters.min_score}</span>}
                {c.follow_up_days && <span>Follow-ups: day {c.follow_up_days.join(", ")}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {c.status === "draft" && (
                <button className="btn-primary text-xs py-1.5" onClick={() => handleLaunch(c.id)}>
                  <Play size={13} /> Launch
                </button>
              )}
              {c.status === "active" && (
                <button className="btn-secondary text-xs py-1.5" onClick={() => handlePause(c.id)}>
                  <Pause size={13} /> Pause
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
