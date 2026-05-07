import { useEffect, useState } from "react";
import { Mail, MessageSquare, Send } from "lucide-react";
import { getConversations, getThread, sendMessage } from "../api";

const CHANNEL_ICON = { EMAIL: Mail, WHATSAPP: MessageSquare };

function MessageBubble({ msg }) {
  const isSent = msg.direction === "SENT";
  return (
    <div className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-sm px-4 py-2 rounded-2xl text-sm ${
          isSent
            ? "bg-blue-600 text-white rounded-br-none"
            : "bg-gray-100 text-gray-900 rounded-bl-none"
        }`}
      >
        <div className="flex items-center gap-2 mb-1 opacity-70 text-xs">
          {msg.channel === "EMAIL" ? <Mail size={10} /> : <MessageSquare size={10} />}
          {msg.channel}
        </div>
        {msg.subject && <p className="font-medium mb-1">{msg.subject}</p>}
        <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/<[^>]+>/g, " ").slice(0, 500) }} />
        <p className="text-xs opacity-60 mt-1">
          {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ""}
        </p>
      </div>
    </div>
  );
}

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState([]);
  const [replyForm, setReplyForm] = useState({ channel: "EMAIL", content: "", subject: "" });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getConversations().then((r) => setConversations(r.data));
  }, []);

  const openThread = async (lead) => {
    setSelected(lead);
    const res = await getThread(lead.lead_id);
    setThread(res.data);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setSending(true);
    try {
      await sendMessage({ lead_id: selected.lead_id, ...replyForm });
      const res = await getThread(selected.lead_id);
      setThread(res.data);
      setReplyForm((p) => ({ ...p, content: "", subject: "" }));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Inbox</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No conversations yet</div>
          ) : conversations.map((c) => (
            <button
              key={c.lead_id}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                selected?.lead_id === c.lead_id ? "bg-blue-50" : ""
              }`}
              onClick={() => openThread(c)}
            >
              <p className="font-medium text-sm text-gray-900 truncate">{c.business_name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`badge text-xs ${c.status === "interested" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {c.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            Select a conversation to view messages
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-gray-200 px-5 py-3">
              <h3 className="font-semibold text-gray-900">{selected.business_name}</h3>
              <p className="text-xs text-gray-400">{selected.email || selected.phone}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {thread.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
            </div>

            <form onSubmit={handleSend} className="bg-white border-t border-gray-200 p-4 space-y-2">
              <div className="flex gap-2">
                <select
                  className="input w-36"
                  value={replyForm.channel}
                  onChange={(e) => setReplyForm((p) => ({ ...p, channel: e.target.value }))}
                >
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
                {replyForm.channel === "EMAIL" && (
                  <input
                    className="input flex-1"
                    placeholder="Subject"
                    value={replyForm.subject}
                    onChange={(e) => setReplyForm((p) => ({ ...p, subject: e.target.value }))}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <textarea
                  className="input flex-1 resize-none"
                  rows={2}
                  placeholder="Type your message..."
                  value={replyForm.content}
                  required
                  onChange={(e) => setReplyForm((p) => ({ ...p, content: e.target.value }))}
                />
                <button className="btn-primary self-end" type="submit" disabled={sending}>
                  <Send size={14} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
