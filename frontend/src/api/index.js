import api from "./client";

// Auth
export const login = (email, password) =>
  api.post("/auth/login", new URLSearchParams({ username: email, password }));
export const register = (data) => api.post("/auth/register", data);
export const getMe = () => api.get("/auth/me");

// Leads
export const getLeads = (params) => api.get("/leads", { params });
export const getLead = (id) => api.get(`/leads/${id}`);
export const updateLead = (id, data) => api.patch(`/leads/${id}`, data);
export const startExtraction = (params) => api.post("/leads/extract", null, { params });

// Campaigns
export const getCampaigns = () => api.get("/campaigns");
export const getCampaign = (id) => api.get(`/campaigns/${id}`);
export const createCampaign = (data) => api.post("/campaigns", data);
export const updateCampaign = (id, data) => api.put(`/campaigns/${id}`, data);
export const launchCampaign = (id) => api.post(`/campaigns/${id}/launch`);
export const pauseCampaign = (id) => api.post(`/campaigns/${id}/pause`);
export const getAudienceCount = (id) => api.get(`/campaigns/${id}/audience-count`);

// Inbox
export const getConversations = () => api.get("/inbox/conversations");
export const getThread = (leadId) => api.get(`/inbox/thread/${leadId}`);
export const sendMessage = (data) => api.post("/inbox/send", data);

// Templates (Claude AI)
export const generateTemplates = (data) => api.post("/templates/generate", data);

// Settings
export const getSettings = () => api.get("/settings");
export const saveSettings = (data) => api.put("/settings", data);
export const testEmail = () => api.post("/settings/test-email");
export const testWhatsApp = () => api.post("/settings/test-whatsapp");

// Analytics
export const getOverview = () => api.get("/analytics/overview");
export const getPipelineStats = () => api.get("/analytics/pipeline");
export const getTopCities = () => api.get("/analytics/top-cities");
export const getTopCategories = () => api.get("/analytics/top-categories");
