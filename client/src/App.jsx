import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";

const socket = io("https://chitchat-server-z5oo.onrender.com");
const API = "https://chitchat-server-z5oo.onrender.com/api/auth";

export default function App() {
  const [page, setPage] = useState("login"); 
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [form, setForm] = useState({ email: "", password: "" });
  const [formError, setFormError] = useState("");
  const [status, setStatus] = useState("idle");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [time, setTime] = useState(new Date());
  const [msgCount, setMsgCount] = useState(0);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const canvasRef = useRef(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto login if token exists
  useEffect(() => {
    if (token) {
      axios.get(`${API}/profile`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => { setUser(res.data.user); setPage("dashboard"); })
        .catch(() => { localStorage.removeItem("token"); setToken(""); setPage("login"); });
    }
  }, []);

  // Matrix rain
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const cols = Math.floor(canvas.width / 20);
    const drops = Array(cols).fill(1);
    const chars = "アイウエオカキクケコ01CHITCAT";
    let frame;
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drops.forEach((y, i) => {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = i % 3 === 0 ? "#0ff4" : "#0f06";
        ctx.fillText(char, i * 20, y * 20);
        if (y * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  // Socket events
  useEffect(() => {
    socket.on("waiting", () => setStatus("waiting"));
    socket.on("chat-start", () => { setStatus("chatting"); setMessages([]); setMsgCount(0); setPartnerTyping(false); });
    socket.on("message", ({ text }) => { setPartnerTyping(false); setMsgCount(c => c + 1); setMessages(prev => [...prev, { text, fromSelf: false, time: new Date() }]); });
    socket.on("partner-typing", () => setPartnerTyping(true));
    socket.on("partner-stop-typing", () => setPartnerTyping(false));
    socket.on("partner-left", () => { setStatus("partner-left"); setPartnerTyping(false); });
    return () => socket.removeAllListeners();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  const handleAuth = async (type) => {
    setFormError("");
    try {
      const res = await axios.post(`${API}/${type}`, form);
      localStorage.setItem("token", res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setPage("dashboard");
    } catch (err) {
      setFormError(err.response?.data?.error || "Something went wrong");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(""); setUser(null); setPage("login");
    setStatus("idle"); setMessages([]);
  };

  const findStranger = () => {
    setMessages([]); setPartnerTyping(false); setMsgCount(0); setStatus("waiting");
    socket.emit("find-stranger", { userId: user?._id });
    setPage("chat");
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    socket.emit("typing");
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => socket.emit("stop-typing"), 1500);
  };

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("stop-typing");
    socket.emit("message", input);
    setMsgCount(c => c + 1);
    setMessages(prev => [...prev, { text: input, fromSelf: true, time: new Date() }]);
    setInput("");
  };

  const fmtTime = (d) => d?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (d) => new Date(d).toLocaleDateString();

  return (
    <div style={s.root}>
      <canvas ref={canvasRef} style={s.canvas} />
      <div style={s.scanlines} />

      {/* AUTH PAGES */}
      {(page === "login" || page === "register") && (
        <div style={s.authWrap}>
          <div style={s.authCard}>
            <div style={s.authBrand}>⬡ CHITCHAT</div>
            <div style={s.authSub}>ANONYMOUS · ENCRYPTED · FREE</div>

            <div style={s.authTabs}>
              <button style={{ ...s.authTab, ...(page === "login" ? s.authTabActive : {}) }} onClick={() => { setPage("login"); setFormError(""); }}>LOGIN</button>
              <button style={{ ...s.authTab, ...(page === "register" ? s.authTabActive : {}) }} onClick={() => { setPage("register"); setFormError(""); }}>REGISTER</button>
            </div>

            <div style={s.authFields}>
              <div style={s.fieldWrap}>
                <div style={s.fieldLabel}>EMAIL</div>
                <input style={s.fieldInput} type="email" placeholder="user@example.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={s.fieldWrap}>
                <div style={s.fieldLabel}>PASSWORD</div>
                <input style={s.fieldInput} type="password" placeholder="••••••••"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  onKeyDown={e => e.key === "Enter" && handleAuth(page)} />
              </div>
              {formError && <div style={s.authError}>⚠ {formError}</div>}
              <button style={s.authBtn} onClick={() => handleAuth(page)}>
                {page === "login" ? "[ LOGIN ]" : "[ CREATE ACCOUNT ]"}
              </button>
            </div>

            <div style={s.authFooter}>Your identity is never revealed to strangers</div>
          </div>
        </div>
      )}

      {/* DASHBOARD */}
      {page === "dashboard" && (
        <div style={s.authWrap}>
          <div style={{ ...s.authCard, maxWidth: 500 }}>
            <div style={s.authBrand}>⬡ CHITCHAT</div>
            <div style={s.dashGreet}>WELCOME BACK, AGENT</div>

            <div style={s.dashGrid}>
              <div style={s.dashStat}>
                <div style={s.dashStatLabel}>IDENTITY</div>
                <div style={s.dashStatVal}>{user?.email}</div>
              </div>
              <div style={s.dashStat}>
                <div style={s.dashStatLabel}>MEMBER SINCE</div>
                <div style={s.dashStatVal}>{fmtDate(user?.createdAt)}</div>
              </div>
              <div style={s.dashStat}>
                <div style={s.dashStatLabel}>TOTAL CHATS</div>
                <div style={{ ...s.dashStatVal, color: "#00cfff" }}>{user?.totalChats || 0}</div>
              </div>
              <div style={s.dashStat}>
                <div style={s.dashStatLabel}>STATUS</div>
                <div style={{ ...s.dashStatVal, color: "#00ff88" }}>ACTIVE</div>
              </div>
            </div>

            <div style={s.dashNote}>
              ⚠ Your email is never shared with strangers.<br />
              You appear completely anonymous in all chats.
            </div>

            <button style={s.authBtn} onClick={findStranger}>
              [ FIND STRANGER ]
            </button>

            <button style={s.logoutBtn} onClick={logout}>LOGOUT</button>
          </div>
        </div>
      )}

      {/* CHAT PAGE */}
      {page === "chat" && (
        <div style={s.layout}>
          {/* LEFT */}
          <div style={s.left}>
            <div style={s.brand}>
              <div style={s.brandGlyph}>⬡</div>
              <div>
                <div style={s.brandName}>CHITCHAT</div>
                <div style={s.brandSub}>ANONYMOUS · ENCRYPTED</div>
              </div>
            </div>

            <div style={s.clockBox}>
              <div style={s.clockLabel}>SYS_TIME</div>
              <div style={s.clockVal}>{fmtTime(time)}</div>
            </div>

            <div style={s.statGrid}>
              <StatCard label="STATUS" value={status === "idle" ? "STANDBY" : status === "waiting" ? "SCANNING" : status === "chatting" ? "LINKED" : "TERMINATED"}
                color={status === "chatting" ? "#00ff88" : status === "waiting" ? "#ffcc00" : status === "partner-left" ? "#ff3366" : "#00cfff"} />
              <StatCard label="MESSAGES" value={String(msgCount).padStart(3, "0")} color="#00cfff" />
              <StatCard label="AGENT" value={user?.email?.split("@")[0].toUpperCase()} color="#bf5fff" />
              <StatCard label="CHATS" value={String(user?.totalChats || 0).padStart(3, "0")} color="#00ff88" />
            </div>

            {(status === "chatting" || status === "partner-left") && (
              <button style={s.nextBtn} onClick={findStranger}>
                {status === "partner-left" ? "[ RECONNECT ]" : "[ NEXT_USER ]"}
              </button>
            )}

            <button style={s.logoutBtn} onClick={() => setPage("dashboard")}>← DASHBOARD</button>
            <div style={s.leftFooter}>v1.0.0 · NO LOGS · NO TRACE</div>
          </div>

          {/* RIGHT */}
          <div style={s.right}>
            <div style={s.topBar}>
              <div style={s.topBarLeft}>
                <span style={{ ...s.statusDot, background: status === "chatting" ? "#00ff88" : status === "waiting" ? "#ffcc00" : "#ff3366", boxShadow: `0 0 8px ${status === "chatting" ? "#00ff88" : status === "waiting" ? "#ffcc00" : "#ff3366"}` }} />
                <span style={s.topBarTitle}>
                  {status === "idle" && "AWAITING CONNECTION"}
                  {status === "waiting" && "SCANNING NETWORK..."}
                  {status === "chatting" && "SECURE CHANNEL ACTIVE"}
                  {status === "partner-left" && "CONNECTION TERMINATED"}
                </span>
              </div>
              <div style={s.topBarRight}>{fmtTime(time)}</div>
            </div>

            <div style={s.chatArea}>
              {status === "waiting" && (
                <div style={s.idleScreen}>
                  <div style={s.radarWrap}>
                    <div style={s.radarRing1} /><div style={s.radarRing2} /><div style={s.radarRing3} />
                    <div style={s.radarDot} />
                  </div>
                  <div style={s.idleTitle}>SCANNING...</div>
                  <div style={s.idleSub}>Searching for a stranger on the network</div>
                </div>
              )}

              {(status === "chatting" || status === "partner-left") && (
                <div style={s.msgList}>
                  <div style={s.msgListInner}>
                    {messages.length === 0 && <div style={s.emptyHint}>// Connection established. Say something.</div>}
                    {messages.map((msg, i) => (
                      <div key={i} style={{ ...s.msgRow, justifyContent: msg.fromSelf ? "flex-end" : "flex-start" }}>
                        <div style={{ ...s.bubble, background: msg.fromSelf ? "linear-gradient(135deg,#6600ff22,#00cfff22)" : "linear-gradient(135deg,#00ff8822,#00cfff11)", borderColor: msg.fromSelf ? "#00cfff88" : "#00ff8888", borderLeftWidth: msg.fromSelf ? 1 : 3, borderRightWidth: msg.fromSelf ? 3 : 1 }}>
                          <div style={s.bubbleSender}>{msg.fromSelf ? user?.email?.split("@")[0].toUpperCase() : "STRANGER"}</div>
                          <div style={s.bubbleText}>{msg.text}</div>
                          <div style={s.bubbleTime}>{fmtTime(msg.time)}</div>
                        </div>
                      </div>
                    ))}
                    {partnerTyping && (
                      <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
                        <div style={{ ...s.bubble, borderColor: "#00ff8844", background: "#00ff8811" }}>
                          <div style={s.bubbleSender}>STRANGER</div>
                          <div style={s.typingDots}>
                            <span style={{ ...s.typingDot, animationDelay: "0s" }} />
                            <span style={{ ...s.typingDot, animationDelay: "0.2s" }} />
                            <span style={{ ...s.typingDot, animationDelay: "0.4s" }} />
                          </div>
                        </div>
                      </div>
                    )}
                    {status === "partner-left" && <div style={s.terminated}>// STRANGER HAS DISCONNECTED</div>}
                    <div ref={bottomRef} />
                  </div>
                </div>
              )}
            </div>

            <div style={s.inputBar}>
              <div style={s.inputWrap}>
                <span style={s.inputPrefix}>&gt;_</span>
                <input style={s.input} value={input} onChange={handleInputChange}
                  onKeyDown={e => e.key === "Enter" && sendMessage()}
                  placeholder="TYPE MESSAGE..." disabled={status !== "chatting"} />
              </div>
              <button style={{ ...s.sendBtn, opacity: status === "chatting" ? 1 : 0.3 }}
                onClick={sendMessage} disabled={status !== "chatting"}>SEND ▶</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; overflow: hidden; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #00cfff44; border-radius: 2px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.05)} }
        @keyframes radarPing { 0%{transform:scale(0.3);opacity:1} 100%{transform:scale(2.5);opacity:0} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
        @keyframes flicker { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:.4} 94%{opacity:1} }
        @keyframes glow { 0%,100%{box-shadow:0 0 10px #00cfff44} 50%{box-shadow:0 0 24px #00cfff99} }
        input::placeholder { color: #333; }
        input:focus { outline: none; border-color: #00cfff44 !important; }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#0a0a0a", border: `1px solid ${color}33`, borderRadius: 4, padding: "10px 12px", borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 9, color: "#444", fontFamily: "'Share Tech Mono',monospace", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color, fontFamily: "'Share Tech Mono',monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
    </div>
  );
}

const s = {
  root: { width: "100vw", height: "100vh", background: "#000", fontFamily: "'Share Tech Mono',monospace", position: "relative", overflow: "hidden" },
  canvas: { position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18, pointerEvents: "none", zIndex: 0 },
  scanlines: { position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none", background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,255,0.015) 2px,rgba(0,255,255,0.015) 4px)" },
  // AUTH
  authWrap: { position: "relative", zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" },
  authCard: { background: "#05050f", border: "1px solid #00cfff22", borderRadius: 8, padding: "40px 36px", width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 20 },
  authBrand: { fontFamily: "'Orbitron',monospace", fontSize: 24, fontWeight: 900, color: "#00cfff", textShadow: "0 0 12px #00cfff88", textAlign: "center", letterSpacing: 4 },
  authSub: { fontSize: 9, color: "#00cfff44", textAlign: "center", letterSpacing: 3, marginTop: -12 },
  authTabs: { display: "flex", gap: 0, border: "1px solid #00cfff22", borderRadius: 4, overflow: "hidden" },
  authTab: { flex: 1, background: "transparent", border: "none", color: "#444", fontFamily: "'Share Tech Mono',monospace", fontSize: 13, padding: "10px", cursor: "pointer", letterSpacing: 2 },
  authTabActive: { background: "#00cfff15", color: "#00cfff", borderBottom: "2px solid #00cfff" },
  authFields: { display: "flex", flexDirection: "column", gap: 14 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 10, color: "#00cfff66", letterSpacing: 2 },
  fieldInput: { background: "#0a0a1a", border: "1px solid #00cfff22", borderRadius: 4, padding: "12px 14px", color: "#e0e0e0", fontFamily: "'Share Tech Mono',monospace", fontSize: 14 },
  authError: { fontSize: 12, color: "#ff3366", padding: "8px 12px", background: "#ff336611", border: "1px solid #ff336633", borderRadius: 4 },
  authBtn: { background: "transparent", border: "1px solid #00cfff", color: "#00cfff", fontFamily: "'Orbitron',monospace", fontSize: 13, padding: "14px", cursor: "pointer", borderRadius: 4, letterSpacing: 3, textShadow: "0 0 8px #00cfff66", boxShadow: "0 0 20px #00cfff11", animation: "glow 2s ease-in-out infinite" },
  authFooter: { fontSize: 10, color: "#333", textAlign: "center", letterSpacing: 1 },
  // DASHBOARD
  dashGreet: { fontFamily: "'Orbitron',monospace", fontSize: 13, color: "#00cfff66", textAlign: "center", letterSpacing: 3 },
  dashGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  dashStat: { background: "#0a0a0a", border: "1px solid #ffffff0a", borderRadius: 4, padding: "12px 14px" },
  dashStatLabel: { fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 6 },
  dashStatVal: { fontSize: 13, color: "#e0e0e0", wordBreak: "break-all" },
  dashNote: { fontSize: 11, color: "#444", textAlign: "center", lineHeight: 1.8, padding: "12px", border: "1px solid #ffffff08", borderRadius: 4 },
  logoutBtn: { background: "transparent", border: "1px solid #ff336633", color: "#ff336688", fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: "10px", cursor: "pointer", borderRadius: 4, letterSpacing: 2 },
  // CHAT LAYOUT
  layout: { position: "relative", zIndex: 2, display: "flex", height: "100vh" },
  left: { width: 260, minWidth: 260, background: "#050510", borderRight: "1px solid #00cfff15", display: "flex", flexDirection: "column", padding: "20px 16px", gap: 16, overflowY: "auto" },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandGlyph: { fontSize: 28, color: "#00cfff", textShadow: "0 0 20px #00cfff", animation: "pulse 3s ease-in-out infinite" },
  brandName: { fontFamily: "'Orbitron',monospace", fontSize: 16, fontWeight: 900, color: "#00cfff", textShadow: "0 0 10px #00cfff88", letterSpacing: 2 },
  brandSub: { fontSize: 8, color: "#00cfff44", letterSpacing: 2, marginTop: 2 },
  clockBox: { background: "#0a0a18", border: "1px solid #00cfff15", borderRadius: 4, padding: "10px 14px", textAlign: "center" },
  clockLabel: { fontSize: 9, color: "#444", letterSpacing: 3, marginBottom: 4 },
  clockVal: { fontFamily: "'Orbitron',monospace", fontSize: 24, color: "#00cfff", textShadow: "0 0 12px #00cfff66" },
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  nextBtn: { background: "transparent", border: "1px solid #ff336644", color: "#ff3366", fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: "10px", cursor: "pointer", borderRadius: 4, letterSpacing: 2, textShadow: "0 0 8px #ff336666" },
  leftFooter: { fontSize: 9, color: "#1a1a1a", textAlign: "center", marginTop: "auto", letterSpacing: 1 },
  right: { flex: 1, display: "flex", flexDirection: "column", background: "#02020f", overflow: "hidden" },
  topBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid #00cfff15", background: "#04041a" },
  topBarLeft: { display: "flex", alignItems: "center", gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  topBarTitle: { fontSize: 12, color: "#00cfff88", letterSpacing: 2 },
  topBarRight: { fontSize: 11, color: "#333" },
  chatArea: { flex: 1, overflow: "hidden", position: "relative" },
  idleScreen: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 20 },
  idleTitle: { fontFamily: "'Orbitron',monospace", fontSize: 18, color: "#00cfff", letterSpacing: 4, textShadow: "0 0 12px #00cfff66" },
  idleSub: { fontSize: 12, color: "#444", textAlign: "center", lineHeight: 1.8 },
  radarWrap: { position: "relative", width: 100, height: 100, display: "flex", alignItems: "center", justifyContent: "center" },
  radarRing1: { position: "absolute", width: 100, height: 100, borderRadius: "50%", border: "1px solid #00cfff44", animation: "radarPing 2s ease-out infinite" },
  radarRing2: { position: "absolute", width: 100, height: 100, borderRadius: "50%", border: "1px solid #00cfff44", animation: "radarPing 2s ease-out infinite 0.6s" },
  radarRing3: { position: "absolute", width: 100, height: 100, borderRadius: "50%", border: "1px solid #00cfff44", animation: "radarPing 2s ease-out infinite 1.2s" },
  radarDot: { width: 10, height: 10, borderRadius: "50%", background: "#00cfff", boxShadow: "0 0 12px #00cfff", animation: "pulse 1s ease-in-out infinite" },
  msgList: { height: "100%", overflowY: "auto", padding: "20px 24px" },
  msgListInner: { display: "flex", flexDirection: "column", gap: 12, minHeight: "100%" },
  msgRow: { display: "flex" },
  bubble: { maxWidth: "70%", padding: "10px 14px", borderRadius: 4, border: "1px solid", backdropFilter: "blur(4px)" },
  bubbleSender: { fontSize: 9, color: "#444", letterSpacing: 2, marginBottom: 4 },
  bubbleText: { fontSize: 14, color: "#e0e0e0", lineHeight: 1.5, wordBreak: "break-word" },
  bubbleTime: { fontSize: 9, color: "#333", marginTop: 6, textAlign: "right" },
  typingDots: { display: "flex", gap: 4, alignItems: "center", padding: "2px 0" },
  typingDot: { width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "bounce 1.2s ease-in-out infinite", boxShadow: "0 0 6px #00ff88" },
  emptyHint: { fontSize: 11, color: "#1a1a2e", textAlign: "center", margin: "auto", letterSpacing: 1 },
  terminated: { textAlign: "center", fontSize: 11, color: "#ff336655", letterSpacing: 2, padding: "12px", border: "1px solid #ff336622", borderRadius: 4 },
  inputBar: { display: "flex", gap: 10, padding: "16px 24px", borderTop: "1px solid #00cfff15", background: "#04041a", alignItems: "center" },
  inputWrap: { flex: 1, display: "flex", alignItems: "center", background: "#0a0a1a", border: "1px solid #00cfff22", borderRadius: 4, paddingLeft: 12 },
  inputPrefix: { color: "#00cfff", fontSize: 14, marginRight: 8, userSelect: "none" },
  input: { flex: 1, background: "transparent", border: "none", outline: "none", color: "#e0e0e0", fontFamily: "'Share Tech Mono',monospace", fontSize: 14, padding: "12px 12px 12px 0", letterSpacing: 1 },
  sendBtn: { background: "transparent", border: "1px solid #00cfff44", color: "#00cfff", fontFamily: "'Share Tech Mono',monospace", fontSize: 12, padding: "12px 20px", borderRadius: 4, letterSpacing: 2, cursor: "pointer", textShadow: "0 0 8px #00cfff66" },
};