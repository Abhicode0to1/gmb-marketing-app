import { useEffect, useState } from "react";
import { Mail, MessageSquare, CheckCircle, XCircle, Loader, Eye, EyeOff, Copy, ExternalLink } from "lucide-react";
import { getSettings, saveSettings, testEmail, testWhatsApp } from "../api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

function StatusBadge({ ok }) {
  return ok ? (
    <span className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
      <CheckCircle size={13} /> Connected
    </span>
  ) : (
    <span className="flex items-center gap-1.5 text-gray-400 text-xs font-medium">
      <XCircle size={13} /> Not configured
    </span>
  );
}

function SecretInput({ label, name, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <input
          className="input pr-10"
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          onClick={() => setShow((s) => !s)}
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function TestResult({ result }) {
  if (!result) return null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${result.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
      {result.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
      {result.message}
    </div>
  );
}

export default function Settings() {
  const [status, setStatus] = useState({ email: false, whatsapp: false });
  const [emailForm, setEmailForm] = useState({ GMAIL_ADDRESS: "", GMAIL_APP_PASSWORD: "", GMAIL_FROM_NAME: "" });
  const [waForm, setWaForm] = useState({ WA_PHONE_NUMBER_ID: "", WA_ACCESS_TOKEN: "", WA_VERIFY_TOKEN: "" });
  const [emailSaving, setEmailSaving] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [emailTesting, setEmailTesting] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const [emailTest, setEmailTest] = useState(null);
  const [waTest, setWaTest] = useState(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${API_BASE}/webhooks/whatsapp`;

  useEffect(() => {
    getSettings().then((res) => {
      const { values, status: s } = res.data;
      setStatus(s);
      setEmailForm({
        GMAIL_ADDRESS: values.GMAIL_ADDRESS || "",
        GMAIL_APP_PASSWORD: "",
        GMAIL_FROM_NAME: values.GMAIL_FROM_NAME || "",
      });
      setWaForm({
        WA_PHONE_NUMBER_ID: values.WA_PHONE_NUMBER_ID || "",
        WA_ACCESS_TOKEN: "",
        WA_VERIFY_TOKEN: values.WA_VERIFY_TOKEN || "",
      });
    });
  }, []);

  const handleEmailChange = (e) => setEmailForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleWaChange = (e) => setWaForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const saveEmail = async () => {
    setEmailSaving(true);
    setEmailTest(null);
    try {
      await saveSettings(emailForm);
      const res = await getSettings();
      setStatus(res.data.status);
    } finally {
      setEmailSaving(false);
    }
  };

  const saveWa = async () => {
    setWaSaving(true);
    setWaTest(null);
    try {
      await saveSettings(waForm);
      const res = await getSettings();
      setStatus(res.data.status);
    } finally {
      setWaSaving(false);
    }
  };

  const runEmailTest = async () => {
    setEmailTesting(true);
    setEmailTest(null);
    try {
      const res = await testEmail();
      setEmailTest(res.data);
    } finally {
      setEmailTesting(false);
    }
  };

  const runWaTest = async () => {
    setWaTesting(true);
    setWaTest(null);
    try {
      const res = await testWhatsApp();
      setWaTest(res.data);
    } finally {
      setWaTesting(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500 text-sm">Configure your email and WhatsApp channels</p>
      </div>

      {/* Email Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Mail size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Email (Gmail SMTP)</h3>
              <p className="text-xs text-gray-400">Send outreach emails via your Gmail account</p>
            </div>
          </div>
          <StatusBadge ok={status.email} />
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">How to get an App Password:</p>
          <p>1. Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="underline">myaccount.google.com/security</a></p>
          <p>2. Enable <strong>2-Step Verification</strong> if not already on</p>
          <p>3. Search "App Passwords" → create one for "Mail"</p>
          <p>4. Paste the 16-character code below (spaces don't matter)</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Gmail Address</label>
            <input className="input" name="GMAIL_ADDRESS" value={emailForm.GMAIL_ADDRESS} onChange={handleEmailChange} placeholder="yourname@gmail.com" type="email" />
          </div>
          <SecretInput
            label={`App Password${status.email ? " (leave blank to keep existing)" : ""}`}
            name="GMAIL_APP_PASSWORD"
            value={emailForm.GMAIL_APP_PASSWORD}
            onChange={handleEmailChange}
            placeholder={status.email ? "••••••••••• (already set)" : "16-character app password"}
          />
          <div>
            <label className="label">From Name</label>
            <input className="input" name="GMAIL_FROM_NAME" value={emailForm.GMAIL_FROM_NAME} onChange={handleEmailChange} placeholder="e.g. Excel Technologies" />
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1 justify-center" onClick={saveEmail} disabled={emailSaving}>
            {emailSaving ? <><Loader size={14} className="animate-spin" /> Saving...</> : "Save Email Settings"}
          </button>
          {status.email && (
            <button className="btn-secondary" onClick={runEmailTest} disabled={emailTesting}>
              {emailTesting ? <Loader size={14} className="animate-spin" /> : "Send Test Email"}
            </button>
          )}
        </div>
        <TestResult result={emailTest} />
      </div>

      {/* WhatsApp Section */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare size={16} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">WhatsApp (Meta Cloud API)</h3>
              <p className="text-xs text-gray-400">Send messages via WhatsApp Business Platform</p>
            </div>
          </div>
          <StatusBadge ok={status.whatsapp} />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Where to find these in Facebook Developer:</p>
          <p>1. Go to <strong>developers.facebook.com</strong> → your app → WhatsApp → API Setup</p>
          <p>2. <strong>Phone Number ID</strong> — shown under "From" phone number</p>
          <p>3. <strong>Access Token</strong> — generate a permanent token in System Users → Business Settings</p>
          <p>4. <strong>Verify Token</strong> — any secret string you choose (used to verify webhook)</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Phone Number ID</label>
            <input className="input" name="WA_PHONE_NUMBER_ID" value={waForm.WA_PHONE_NUMBER_ID} onChange={handleWaChange} placeholder="e.g. 123456789012345" />
          </div>
          <SecretInput
            label={`Permanent Access Token${status.whatsapp ? " (leave blank to keep existing)" : ""}`}
            name="WA_ACCESS_TOKEN"
            value={waForm.WA_ACCESS_TOKEN}
            onChange={handleWaChange}
            placeholder={status.whatsapp ? "••••••••••• (already set)" : "EAAxxxxx..."}
          />
          <div>
            <label className="label">Webhook Verify Token</label>
            <input className="input" name="WA_VERIFY_TOKEN" value={waForm.WA_VERIFY_TOKEN} onChange={handleWaChange} placeholder="e.g. my_secret_token_123" />
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn-primary flex-1 justify-center" onClick={saveWa} disabled={waSaving}>
            {waSaving ? <><Loader size={14} className="animate-spin" /> Saving...</> : "Save WhatsApp Settings"}
          </button>
          {status.whatsapp && (
            <button className="btn-secondary" onClick={runWaTest} disabled={waTesting}>
              {waTesting ? <Loader size={14} className="animate-spin" /> : "Test Connection"}
            </button>
          )}
        </div>
        <TestResult result={waTest} />

        {/* Webhook URL */}
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-medium text-gray-600 mb-2">Webhook URL (paste this in Facebook Developer → WhatsApp → Configuration):</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <code className="flex-1 text-xs text-gray-700 break-all">{webhookUrl}</code>
            <button onClick={copyWebhook} className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors">
              {copied ? <CheckCircle size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Callback URL field in Meta app → Subscribe to <strong>messages</strong> webhook field</p>
        </div>
      </div>
    </div>
  );
}
