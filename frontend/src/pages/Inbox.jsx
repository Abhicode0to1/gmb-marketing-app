import { useEffect, useRef, useState } from "react";
import { Mail, MessageSquare, Send, Phone, Globe, Loader, RefreshCw } from "lucide-react";
import { getConversations, getThread, sendMessage } from "../api";

const STATUS_COLORS = {
  new: "bg-gray-100 text-gray-500",
  contacted: "bg-yellow-100 text-yellow-700",
  interested: "bg-green-100 text-green-700",
  negotiating: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-600",
};

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now - 86400000).toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}

function MessageBubble({ msg }) {
  const isSent = msg.direction === "SENT" || msg.direction === "sent";
  const isEmail = msg.channel === "EMAIL" || msg.channel === "email";

  const plainText = msg.content
    ? msg.content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : "";

  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"} group`}>
      <div className={`max-w-[70%] space-y-1 ${isSent ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isSent
              ? isEmail
                ? "bg-blue-600 text-white rounded-br-sm"
                : "bg-green-600 text-white rounded-br-sm"
              : "bg-white border border-gray-200 text-gray-900 rounded-bl-sm shadow-sm"
          }`}
        >
          {/* Channel + subject header */}
          <div className={`flex items-center gap-1.5 mb-1.5 text-xs ${isSent ? "opacity-70" : "text-gray-400"}`}>
            {isEmail ? <Mail size={10} /> : <MessageSquare size={10} />}
            <span>{isEmail ? "Email" : "WhatsApp"}</span>
            {msg.subject && <span className="mx-1">·</span>}
            {msg.subject && <span className="font-medium truncate max-w-[200px]">{msg.subject}</span>}
          </div>
          <p className="whitespace-pre-wrap break-words">{plainText.slice(0, 600)}{plainText.length > 600 ? "…" : ""}</p>
        </div>
        <span className={`text-xs text-gray-400 px-1 ${isSent ? "text-right" : "text-left"}`}>
          {formatTime(msg.sent_at || msg.created_at)}
          {isSent && (
            <span className="ml-1 opacity-60">
              {msg.status === "opened" ? " ✓✓" : msg.status === "delivered" ? " ✓✓" : " ✓"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

function ConversationItem({ c, selected, onClick }) {
  return (
    <button
      className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        selected ? "bg-blue-50 border-l-2 border-l-blue-500" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm text-gray-900 truncate">{c.business_name}</p>
        {c.last_contacted_at && (
          <span className="text-xs text-gray-400 shrink-0">{formatTime(c.last_contacted_at)}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className={`badge text-xs ${STATUS_COLORS[c.status] || "bg-gray-100 text-gray-500"}`}>
          {c.status}
        </span>
        {c.email && <Mail size={10} className="text-gray-300" />}
        {c.phone && <Phone size={10} className="text-gray-300" />}
      </div>
    </button>
  );
}

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState([]);
  const [channel, setChannel] = useState("EMAIL");
  const [content, setContent] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendError, setSendError] = useState("");
  const threadRef = useRef(null);

  const loadConversations = async () => {
    setRefreshing(true);
    try {
      const res = await getConversations();
      setConversations(res.data);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [thread]);

  const openThread = async (c) => {
    setSelected(c);
    setLoadingThread(true);
    setSendError("");
    try {
      const res = await getThread(c.lead_id);
      setThread(res.data);
      // Default channel based on available contact
      if (c.email) setChannel("EMAIL");
      else if (c.phone) setChannel("WHATSAPP");
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selected || !content.trim()) return;
    setSending(true);
    setSendError("");
    try {
      await sendMessage({ lead_id: selected.lead_id, channel, content, subject: channel === "EMAIL" ? subject : undefined });
      const res = await getThread(selected.lead_id);
      setThread(res.data);
      setContent("");
      setSubject("");
    } catch (err) {
      setSendError(err.response?.data?.detail || "Failed to send. Check Settings → credentials.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar — conversation list */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Inbox</h2>
          <button onClick={loadConversations} disabled={refreshing} className="text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-10 text-center space-y-2">
              <MessageSquare size={28} className="text-gray-200 mx-auto" />
              <p className="text-sm text-gray-400">No conversations yet</p>
              <p className="text-xs text-gray-300">Launch a campaign to start outreach</p>
            </div>
          ) : conversations.map((c) => (
            <ConversationItem
              key={c.lead_id}
              c={c}
              selected={selected?.lead_id === c.lead_id}
              onClick={() => openThread(c)}
            />
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <MessageSquare size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">Select a conversation</p>
            <p className="text-gray-400 text-sm">Choose a lead from the list to view the message thread</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.business_name}</h3>
                <div className="flex items-center gap-3 mt-0.5">
                  {selected.email && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Mail size={11} /> {selected.email}
                    </span>
                  )}
                  {selected.phone && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Phone size={11} /> {selected.phone}
                    </span>
                  )}
                </div>
              </div>
              <span className={`badge ${STATUS_COLORS[selected.status] || "bg-gray-100 text-gray-500"}`}>
                {selected.status}
              </span>
            </div>

            {/* Thread */}
            <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {loadingThread ? (
                <div className="flex justify-center py-8"><Loader size={20} className="animate-spin text-gray-300" /></div>
              ) : thread.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No messages yet</div>
              ) : (
                thread.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
              )}
            </div>

            {/* Reply form */}
            <form onSubmit={handleSend} className="bg-white border-t border-gray-200 px-4 pt-3 pb-4 space-y-2">
              <div className="flex gap-2">
                {/* Channel toggle */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setChannel("EMAIL")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${channel === "EMAIL" ? "bg-blue-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                    disabled={!selected.email}
                  >
                    <Mail size={12} /> Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("WHATSAPP")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${channel === "WHATSAPP" ? "bg-green-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                    disabled={!selected.phone}
                  >
                    <MessageSquare size={12} /> WhatsApp
                  </button>
                </div>
                {channel === "EMAIL" && (
                  <input
                    className="input flex-1 text-sm"
                    placeholder="Subject line"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                )}
              </div>

              {sendError && (
                <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{sendError}</div>
              )}

              <div className="flex gap-2 items-end">
                <textarea
                  className="input flex-1 resize-none text-sm"
                  rows={3}
                  placeholder={channel === "EMAIL" ? "Write your email message..." : "Write your WhatsApp message..."}
                  value={content}
                  required
                  onChange={(e) => setContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(e);
                  }}
                />
                <button
                  className={`px-4 py-2.5 rounded-xl text-white font-medium flex items-center gap-2 transition-colors ${
                    channel === "EMAIL" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                  } disabled:opacity-50`}
                  type="submit"
                  disabled={sending || !content.trim()}
                >
                  {sending ? <Loader size={15} className="animate-spin" /> : <Send size={15} />}
                </button>
              </div>
              <p className="text-xs text-gray-400">Press Ctrl+Enter to send</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
