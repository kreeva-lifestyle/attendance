import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { 
  LayoutDashboard, Users, CalendarDays, DollarSign, Settings, Bell, 
  LogOut, Search, Filter, Upload, Plus, Edit, Trash2, Eye, Printer,
  ChevronDown, ChevronRight, X, Check, AlertCircle, FileSpreadsheet,
  Clock, TrendingUp, UserCheck, UserX, Menu, Moon, Sun, Download,
  Building2, Shield, ShieldCheck, ShieldAlert, RefreshCw, Calculator
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";

// ─── SUPABASE CONFIG ─────────────────────────────────
const SUPABASE_URL = "https://hrgxygfwdtphxjzfapbe.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyZ3h5Z2Z3ZHRwaHhqemZhcGJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzA1MTksImV4cCI6MjA5MDQ0NjUxOX0.rROlNXBGMhlAyKAPI0fC0uG12xW3Qjb1wP1CRe9GxKs";

// Lightweight Supabase client
const supabase = {
  token: null,
  user: null,

  headers() {
    const h = { "Content-Type": "application/json", "apikey": SUPABASE_KEY };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  },

  async auth_signUp(email, password, fullName) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST", headers: this.headers(),
      body: JSON.stringify({ email, password, data: { full_name: fullName } })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.msg);
    if (data.access_token) { this.token = data.access_token; this.user = data.user; }
    return data;
  },

  async auth_signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: this.headers(),
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.msg || "Login failed");
    this.token = data.access_token;
    this.user = data.user;
    return data;
  },

  async auth_signOut() {
    if (this.token) {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: this.headers() });
    }
    this.token = null; this.user = null;
  },

  async query(table, { select = "*", filters = [], order, limit, single = false } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    filters.forEach(f => { url += `&${f}`; });
    if (order) url += `&order=${order}`;
    if (limit) url += `&limit=${limit}`;
    const h = this.headers();
    if (single) h["Accept"] = "application/vnd.pgrst.object+json";
    const res = await fetch(url, { headers: h });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Query failed"); }
    return res.json();
  },

  async insert(table, data, { returnData = true } = {}) {
    const h = this.headers();
    if (returnData) h["Prefer"] = "return=representation";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST", headers: h, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Insert failed"); }
    return returnData ? res.json() : null;
  },

  async update(table, data, filters) {
    const h = this.headers();
    h["Prefer"] = "return=representation";
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    filters.forEach((f, i) => { url += (i > 0 ? "&" : "") + f; });
    const res = await fetch(url, { method: "PATCH", headers: h, body: JSON.stringify(data) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Update failed"); }
    return res.json();
  },

  async delete(table, filters) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?`;
    filters.forEach((f, i) => { url += (i > 0 ? "&" : "") + f; });
    const res = await fetch(url, { method: "DELETE", headers: this.headers() });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Delete failed"); }
    return true;
  },

  async upsert(table, data) {
    const h = this.headers();
    h["Prefer"] = "return=representation,resolution=merge-duplicates";
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST", headers: h, body: JSON.stringify(data)
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Upsert failed"); }
    return res.json();
  }
};

// ─── HELPERS ─────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmt = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtDec = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);

const cn = (...classes) => classes.filter(Boolean).join(" ");

const STATUS_COLORS = {
  present: "bg-emerald-500/20 text-emerald-400",
  absent: "bg-red-500/20 text-red-400",
  half_day: "bg-amber-500/20 text-amber-400",
  leave: "bg-blue-500/20 text-blue-400",
  holiday: "bg-purple-500/20 text-purple-400",
  draft: "bg-gray-500/20 text-gray-400",
  calculated: "bg-cyan-500/20 text-cyan-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  paid: "bg-green-500/20 text-green-300"
};

const ROLE_ICONS = { super_admin: ShieldAlert, admin: ShieldCheck, viewer: Shield };
const ROLE_COLORS = { super_admin: "text-rose-400", admin: "text-cyan-400", viewer: "text-gray-400" };

// ─── TOAST SYSTEM ─────────────────────────────────
const ToastContext = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
    {toasts.map(t => (
      <div key={t.id} className={cn(
        "px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 animate-slideIn",
        t.type === "success" ? "bg-emerald-900/80 border-emerald-500/30 text-emerald-200" :
        t.type === "error" ? "bg-red-900/80 border-red-500/30 text-red-200" :
        "bg-cyan-900/80 border-cyan-500/30 text-cyan-200"
      )}>
        {t.type === "success" ? <Check size={16} /> : t.type === "error" ? <AlertCircle size={16} /> : <Bell size={16} />}
        <span className="text-sm flex-1">{t.message}</span>
        <button onClick={() => removeToast(t.id)}><X size={14} /></button>
      </div>
    ))}
  </div>
);

// ─── REUSABLE COMPONENTS ─────────────────────────
const Btn = ({ children, variant = "primary", size = "md", icon: Icon, onClick, disabled, className, ...props }) => {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-200 active:scale-[0.97]";
  const variants = {
    primary: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20",
    secondary: "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20",
    danger: "bg-red-500/20 text-red-400 border border-red-500/20 hover:bg-red-500/30",
    ghost: "text-gray-400 hover:text-white hover:bg-white/5",
    success: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30"
  };
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button className={cn(base, variants[variant], sizes[size], disabled && "opacity-50 cursor-not-allowed", className)} onClick={onClick} disabled={disabled} {...props}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} />} {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, error, className, ...props }) => (
  <div className={cn("space-y-1.5", className)}>
    {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
    <div className="relative">
      {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />}
      <input className={cn(
        "w-full bg-white/5 border rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all",
        Icon && "pl-10",
        error ? "border-red-500/50 focus:ring-red-500/30" : "border-white/10 focus:ring-cyan-500/30 focus:border-cyan-500/50"
      )} {...props} />
    </div>
    {error && <p className="text-xs text-red-400">{error}</p>}
  </div>
);

const Select = ({ label, options, className, ...props }) => (
  <div className={cn("space-y-1.5", className)}>
    {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
    <select className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all" {...props}>
      {options.map(o => <option key={o.value} value={o.value} className="bg-gray-900">{o.label}</option>)}
    </select>
  </div>
);

const Card = ({ children, className, hover, onClick }) => (
  <div className={cn(
    "bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 backdrop-blur-sm",
    hover && "hover:bg-white/[0.05] hover:border-white/10 cursor-pointer transition-all duration-300",
    className
  )} onClick={onClick}>{children}</div>
);

const StatCard = ({ icon: Icon, label, value, sub, color = "cyan", trend }) => (
  <Card className="relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-500/5 rounded-full -translate-x-4 -translate-y-8 group-hover:bg-${color}-500/10 transition-colors`} />
    <div className="flex items-start justify-between relative">
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl bg-${color}-500/10`}>
        <Icon size={20} className={`text-${color}-400`} />
      </div>
    </div>
    {trend !== undefined && (
      <div className={cn("flex items-center gap-1 mt-3 text-xs", trend >= 0 ? "text-emerald-400" : "text-red-400")}>
        <TrendingUp size={12} className={trend < 0 ? "rotate-180" : ""} /> {Math.abs(trend)}% vs last month
      </div>
    )}
  </Card>
);

const Badge = ({ children, color = "gray" }) => (
  <span className={cn("px-2.5 py-1 rounded-lg text-xs font-medium capitalize", STATUS_COLORS[color] || `bg-${color}-500/20 text-${color}-400`)}>{children}</span>
);

const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto", wide ? "w-full max-w-3xl" : "w-full max-w-lg")}>
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="p-4 rounded-2xl bg-white/5 mb-4"><Icon size={32} className="text-gray-600" /></div>
    <h3 className="text-lg font-medium text-gray-400 mb-1">{title}</h3>
    <p className="text-sm text-gray-600 mb-4 max-w-xs">{subtitle}</p>
    {action}
  </div>
);

const ConfirmDialog = ({ open, onClose, onConfirm, title, message }) => (
  <Modal open={open} onClose={onClose} title={title || "Confirm Action"}>
    <p className="text-gray-400 mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
      <Btn variant="danger" onClick={() => { onConfirm(); onClose(); }}>Confirm Delete</Btn>
    </div>
  </Modal>
);

// ─── PRINT UTILITY ─────────────────────────────────
const printTable = (title, headers, rows) => {
  const w = window.open("", "_blank");
  w.document.write(`<html><head><title>${title}</title><style>
    body{font-family:system-ui,sans-serif;padding:20px;color:#333}
    h1{font-size:20px;margin-bottom:5px}
    p{color:#666;font-size:12px;margin-bottom:15px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#1a1a2e;color:white;padding:10px 12px;text-align:left;font-weight:500}
    td{padding:8px 12px;border-bottom:1px solid #eee}
    tr:nth-child(even){background:#f9f9fb}
    @media print{body{padding:0}button{display:none}}
  </style></head><body>
    <h1>${title}</h1><p>Generated: ${new Date().toLocaleString()}</p>
    <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <br/><button onclick="window.print()" style="padding:8px 20px;background:#0891b2;color:white;border:none;border-radius:8px;cursor:pointer">Print</button>
  </body></html>`);
  w.document.close();
};

// ─── LOGIN PAGE ─────────────────────────────────
const LoginPage = ({ onLogin, toast }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await supabase.auth_signUp(email, password, fullName);
        toast("Account created! You can now log in.", "success");
        setMode("login");
      } else {
        const data = await supabase.auth_signIn(email, password);
        const profile = await supabase.query("profiles", { filters: [`id=eq.${data.user.id}`], single: true });
        onLogin(data.user, profile, data.access_token);
      }
    } catch (err) { toast(err.message, "error"); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{animationDelay:"1s"}} />
      </div>
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25 mb-4">
            <Building2 size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AttendFlow</h1>
          <p className="text-gray-500 text-sm mt-1">Attendance & Salary Management</p>
        </div>
        <Card className="!p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && <Input label="Full Name" placeholder="Your name" value={fullName} onChange={e => setFullName(e.target.value)} required />}
            <Input label="Email" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
            <Btn className="w-full !mt-6" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}</Btn>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <button className="text-cyan-400 hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [workSettings, setWorkSettings] = useState([]);
  const [loading, setLoading] = useState(false);

  const toast = useCallback((message, type = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);
  const removeToast = (id) => setToasts(t => t.filter(x => x.id !== id));

  const canEdit = profile?.role === "super_admin" || profile?.role === "admin";
  const isSuperAdmin = profile?.role === "super_admin";

  const loadData = useCallback(async () => {
    if (!supabase.token) return;
    setLoading(true);
    try {
      const [emps, notifs, ws] = await Promise.all([
        supabase.query("att_employees", { order: "name.asc" }),
        supabase.query("att_notifications", { order: "created_at.desc", limit: 50 }),
        supabase.query("att_work_settings", { order: "year.desc,month.desc" })
      ]);
      setEmployees(emps || []);
      setNotifications(notifs || []);
      setWorkSettings(ws || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  const loadAttendance = useCallback(async (month, year) => {
    if (!supabase.token) return;
    try {
      const startDate = `${year}-${String(month).padStart(2,"0")}-01`;
      const endMonth = month === 12 ? 1 : month + 1;
      const endYear = month === 12 ? year + 1 : year;
      const endDate = `${endYear}-${String(endMonth).padStart(2,"0")}-01`;
      const data = await supabase.query("att_attendance", {
        filters: [`date=gte.${startDate}`, `date=lt.${endDate}`],
        order: "date.asc"
      });
      setAttendance(data || []);
    } catch (err) { console.error(err); }
  }, []);

  const loadSalaryRecords = useCallback(async (month, year) => {
    if (!supabase.token) return;
    try {
      const data = await supabase.query("att_salary_records", {
        filters: month ? [`month=eq.${month}`, `year=eq.${year}`] : [],
        order: "year.desc,month.desc"
      });
      setSalaryRecords(data || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => { if (user) loadData(); }, [user, loadData]);

  const handleLogin = (u, p, t) => { setUser(u); setProfile(p); supabase.token = t; supabase.user = u; };
  const handleLogout = async () => {
    await supabase.auth_signOut();
    setUser(null); setProfile(null); setPage("dashboard");
  };

  if (!user) return <><LoginPage onLogin={handleLogin} toast={toast} /><ToastContext toasts={toasts} removeToast={removeToast} /></>;

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "employees", label: "Employees", icon: Users },
    { id: "attendance", label: "Attendance", icon: CalendarDays },
    { id: "salary", label: "Salary", icon: DollarSign },
    { id: "notifications", label: "Alerts", icon: Bell, badge: notifications.filter(n=>!n.is_read).length || null },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 h-screen w-64 bg-[#0d0d14] border-r border-white/[0.04] flex flex-col z-50 transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-5 border-b border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Building2 size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">AttendFlow</h1>
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">Salary Manager</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map(n => (
            <button key={n.id} onClick={() => { setPage(n.id); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200",
                page === n.id ? "bg-cyan-500/10 text-cyan-400 font-medium" : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]"
              )}>
              <n.icon size={18} />
              <span className="flex-1 text-left">{n.label}</span>
              {n.badge && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{n.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">
              {(profile?.full_name || profile?.email || "U")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-300 truncate">{profile?.full_name || profile?.email}</p>
              <p className={cn("text-[10px] capitalize flex items-center gap-1", ROLE_COLORS[profile?.role] || "text-gray-500")}>
                {profile?.role?.replace("_", " ")}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/5 transition-all">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.04] px-4 lg:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 hover:bg-white/5 rounded-xl" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
            <h2 className="text-lg font-semibold capitalize">{page === "dashboard" ? "Dashboard" : page}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-colors">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setPage("notifications")} className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-colors relative">
              <Bell size={16} />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {page === "dashboard" && <DashboardPage employees={employees} attendance={attendance} salaryRecords={salaryRecords} loadAttendance={loadAttendance} loadSalaryRecords={loadSalaryRecords} />}
          {page === "employees" && <EmployeesPage employees={employees} setEmployees={setEmployees} canEdit={canEdit} isSuperAdmin={isSuperAdmin} toast={toast} loadData={loadData} />}
          {page === "attendance" && <AttendancePage employees={employees} attendance={attendance} setAttendance={setAttendance} canEdit={canEdit} toast={toast} loadAttendance={loadAttendance} />}
          {page === "salary" && <SalaryPage employees={employees} salaryRecords={salaryRecords} setSalaryRecords={setSalaryRecords} workSettings={workSettings} canEdit={canEdit} isSuperAdmin={isSuperAdmin} toast={toast} loadSalaryRecords={loadSalaryRecords} loadData={loadData} />}
          {page === "notifications" && <NotificationsPage notifications={notifications} setNotifications={setNotifications} toast={toast} />}
          {page === "settings" && <SettingsPage workSettings={workSettings} setWorkSettings={setWorkSettings} profile={profile} canEdit={canEdit} isSuperAdmin={isSuperAdmin} toast={toast} loadData={loadData} />}
        </div>
      </main>

      <ToastContext toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────
const DashboardPage = ({ employees, attendance, salaryRecords, loadAttendance, loadSalaryRecords }) => {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());

  useEffect(() => { loadAttendance(selMonth, selYear); loadSalaryRecords(selMonth, selYear); }, [selMonth, selYear]);

  const activeEmps = employees.filter(e => e.status === "active");
  const presentToday = attendance.filter(a => a.date === now.toISOString().split("T")[0] && a.status === "present").length;
  const absentToday = attendance.filter(a => a.date === now.toISOString().split("T")[0] && a.status === "absent").length;
  const totalSalary = salaryRecords.reduce((s, r) => s + (parseFloat(r.net_salary) || 0), 0);

  const deptData = useMemo(() => {
    const depts = {};
    employees.forEach(e => { if (e.status === "active") depts[e.department || "Other"] = (depts[e.department || "Other"] || 0) + 1; });
    return Object.entries(depts).map(([name, value]) => ({ name, value }));
  }, [employees]);

  const attendanceSummary = useMemo(() => {
    const days = {};
    attendance.forEach(a => {
      if (!days[a.date]) days[a.date] = { date: a.date, present: 0, absent: 0, half_day: 0, leave: 0 };
      days[a.date][a.status] = (days[a.date][a.status] || 0) + 1;
    });
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date)).slice(-15);
  }, [attendance]);

  const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Welcome back</h2>
          <p className="text-sm text-gray-500">{MONTH_FULL[selMonth - 1]} {selYear} Overview</p>
        </div>
        <div className="flex gap-2">
          <Select options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} value={selMonth} onChange={e => setSelMonth(+e.target.value)} />
          <Select options={[2024,2025,2026,2027].map(y => ({ value: y, label: y }))} value={selYear} onChange={e => setSelYear(+e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Active Staff" value={activeEmps.length} sub={`${employees.length} total`} color="cyan" />
        <StatCard icon={UserCheck} label="Present Today" value={presentToday} sub={`of ${activeEmps.length}`} color="emerald" />
        <StatCard icon={UserX} label="Absent Today" value={absentToday} color="red" />
        <StatCard icon={DollarSign} label="Month Salary" value={fmt(totalSalary)} sub={`${salaryRecords.length} processed`} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Attendance Trend</h3>
          {attendanceSummary.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={attendanceSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={d => d.slice(8)} />
                <YAxis tick={{ fill: "#666", fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="present" fill="#06b6d4" radius={[4,4,0,0]} name="Present" />
                <Bar dataKey="absent" fill="#ef4444" radius={[4,4,0,0]} name="Absent" />
                <Bar dataKey="half_day" fill="#f59e0b" radius={[4,4,0,0]} name="Half Day" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-600 text-sm text-center py-16">No attendance data for this month</p>}
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-4">By Department</h3>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={deptData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {deptData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#999" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-600 text-sm text-center py-16">No department data</p>}
        </Card>
      </div>

      {salaryRecords.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">Recent Salary Records</h3>
            <Badge color={salaryRecords.filter(s=>s.status==="paid").length === salaryRecords.length ? "paid" : "calculated"}>
              {salaryRecords.filter(s=>s.status==="paid").length}/{salaryRecords.length} Paid
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5">
                <th className="text-left py-2 text-gray-500 font-medium text-xs">Employee</th>
                <th className="text-right py-2 text-gray-500 font-medium text-xs">Base</th>
                <th className="text-right py-2 text-gray-500 font-medium text-xs">Net</th>
                <th className="text-center py-2 text-gray-500 font-medium text-xs">Status</th>
              </tr></thead>
              <tbody>
                {salaryRecords.slice(0, 8).map(s => {
                  const emp = employees.find(e => e.id === s.employee_id);
                  return (
                    <tr key={s.id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                      <td className="py-2.5 text-gray-300">{emp?.name || "—"}</td>
                      <td className="py-2.5 text-right text-gray-500">{fmt(s.base_salary)}</td>
                      <td className="py-2.5 text-right text-white font-medium">{fmt(s.net_salary)}</td>
                      <td className="py-2.5 text-center"><Badge color={s.status}>{s.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── EMPLOYEES PAGE ─────────────────────────────
const EmployeesPage = ({ employees, setEmployees, canEdit, isSuperAdmin, toast, loadData }) => {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [delEmp, setDelEmp] = useState(null);

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

  const filtered = useMemo(() => {
    return employees.filter(e => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.employee_code.toLowerCase().includes(search.toLowerCase())) return false;
      if (deptFilter !== "all" && e.department !== deptFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [employees, search, deptFilter, statusFilter]);

  const handleSave = async (data) => {
    try {
      if (data.id) {
        const { id, created_at, created_by, ...rest } = data;
        rest.updated_at = new Date().toISOString();
        await supabase.update("att_employees", rest, [`id=eq.${id}`]);
        toast("Employee updated!", "success");
      } else {
        const { id, ...rest } = data;
        await supabase.insert("att_employees", rest);
        toast("Employee added!", "success");
      }
      await loadData();
      setShowAdd(false); setEditEmp(null);
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDelete = async (emp) => {
    try {
      await supabase.delete("att_employees", [`id=eq.${emp.id}`]);
      toast("Employee deleted!", "success");
      await loadData();
    } catch (err) { toast(err.message, "error"); }
  };

  const handleImport = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      const mapped = rows.map(r => ({
        employee_code: String(r["Employee Code"] || r["Code"] || r["ID"] || r["employee_code"] || "").trim(),
        name: String(r["Name"] || r["Employee Name"] || r["name"] || "").trim(),
        email: String(r["Email"] || r["email"] || "").trim() || null,
        phone: String(r["Phone"] || r["Mobile"] || r["phone"] || "").trim() || null,
        department: String(r["Department"] || r["Dept"] || r["department"] || "").trim() || null,
        designation: String(r["Designation"] || r["Position"] || r["Role"] || r["designation"] || "").trim() || null,
        base_salary: parseFloat(r["Salary"] || r["Base Salary"] || r["base_salary"] || 0),
        date_of_joining: r["Date of Joining"] || r["DOJ"] || r["date_of_joining"] || null,
        status: "active"
      })).filter(r => r.employee_code && r.name);

      if (mapped.length === 0) { toast("No valid rows found. Check column headers.", "error"); return; }

      await supabase.upsert("att_employees", mapped);
      await supabase.insert("att_import_logs", { import_type: "employees", file_name: file.name, records_imported: mapped.length });
      toast(`Imported ${mapped.length} employees!`, "success");
      await loadData();
      setShowImport(false);
    } catch (err) { toast(`Import failed: ${err.message}`, "error"); }
  };

  const handlePrint = () => {
    printTable("Employee List", ["Code", "Name", "Dept", "Designation", "Salary", "Status"],
      filtered.map(e => [e.employee_code, e.name, e.department || "—", e.designation || "—", fmt(e.base_salary), e.status])
    );
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(e => ({
      "Employee Code": e.employee_code, Name: e.name, Email: e.email, Phone: e.phone,
      Department: e.department, Designation: e.designation, "Base Salary": e.base_salary, Status: e.status
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees.xlsx");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <Input icon={Search} placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-64" />
          <Select options={[{ value: "all", label: "All Depts" }, ...departments.map(d => ({ value: d, label: d }))]} value={deptFilter} onChange={e => setDeptFilter(e.target.value)} />
          <Select options={[{ value: "all", label: "All Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" icon={Printer} onClick={handlePrint}>Print</Btn>
          <Btn variant="ghost" size="sm" icon={Download} onClick={handleExport}>Export</Btn>
          {canEdit && <Btn variant="secondary" size="sm" icon={Upload} onClick={() => setShowImport(true)}>Import</Btn>}
          {canEdit && <Btn size="sm" icon={Plus} onClick={() => setShowAdd(true)}>Add</Btn>}
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-white/[0.02]">
              {["Code","Name","Department","Designation","Salary","Status",""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={Users} title="No employees" subtitle="Add employees or import from Excel" /></td></tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{e.employee_code}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{e.name}</p>
                      {e.email && <p className="text-gray-600 text-xs">{e.email}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{e.department || "—"}</td>
                  <td className="px-4 py-3 text-gray-400">{e.designation || "—"}</td>
                  <td className="px-4 py-3 text-gray-300 font-medium">{fmt(e.base_salary)}</td>
                  <td className="px-4 py-3"><Badge color={e.status}>{e.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {canEdit && <button onClick={() => setEditEmp(e)} className="p-1.5 hover:bg-white/5 rounded-lg"><Edit size={14} className="text-gray-500" /></button>}
                      {isSuperAdmin && <button onClick={() => setDelEmp(e)} className="p-1.5 hover:bg-red-500/10 rounded-lg"><Trash2 size={14} className="text-gray-500 hover:text-red-400" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/[0.03] text-xs text-gray-600">
          Showing {filtered.length} of {employees.length} employees
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <EmployeeForm open={showAdd || !!editEmp} onClose={() => { setShowAdd(false); setEditEmp(null); }} employee={editEmp} onSave={handleSave} />

      {/* Import Modal */}
      <ImportModal open={showImport} onClose={() => setShowImport(false)} onImport={handleImport} title="Import Employees"
        hint="Excel should have columns: Employee Code, Name, Email, Phone, Department, Designation, Salary" />

      {/* Delete Confirm */}
      <ConfirmDialog open={!!delEmp} onClose={() => setDelEmp(null)} onConfirm={() => handleDelete(delEmp)}
        title="Delete Employee" message={`Are you sure you want to delete "${delEmp?.name}"? This will also remove all their attendance and salary records.`} />
    </div>
  );
};

// ─── EMPLOYEE FORM ─────────────────────────────
const EmployeeForm = ({ open, onClose, employee, onSave }) => {
  const [form, setForm] = useState({});
  useEffect(() => {
    setForm(employee || { employee_code: "", name: "", email: "", phone: "", department: "", designation: "", base_salary: 0, status: "active" });
  }, [employee, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={employee ? "Edit Employee" : "Add Employee"} wide>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Employee Code" placeholder="EMP001" value={form.employee_code || ""} onChange={e => set("employee_code", e.target.value)} required />
        <Input label="Full Name" placeholder="John Doe" value={form.name || ""} onChange={e => set("name", e.target.value)} required />
        <Input label="Email" type="email" placeholder="john@company.com" value={form.email || ""} onChange={e => set("email", e.target.value)} />
        <Input label="Phone" placeholder="+91 98765 43210" value={form.phone || ""} onChange={e => set("phone", e.target.value)} />
        <Input label="Department" placeholder="Design" value={form.department || ""} onChange={e => set("department", e.target.value)} />
        <Input label="Designation" placeholder="Designer" value={form.designation || ""} onChange={e => set("designation", e.target.value)} />
        <Input label="Base Salary (₹)" type="number" placeholder="25000" value={form.base_salary || ""} onChange={e => set("base_salary", parseFloat(e.target.value) || 0)} />
        <Input label="Date of Joining" type="date" value={form.date_of_joining || ""} onChange={e => set("date_of_joining", e.target.value)} />
        <Select label="Status" options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} value={form.status || "active"} onChange={e => set("status", e.target.value)} />
      </div>
      <div className="flex gap-3 justify-end mt-6">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn onClick={() => onSave(form)}>{employee ? "Update" : "Add Employee"}</Btn>
      </div>
    </Modal>
  );
};

// ─── IMPORT MODAL ─────────────────────────────
const ImportModal = ({ open, onClose, onImport, title, hint }) => {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const ref = useRef();

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className={cn("border-2 border-dashed rounded-2xl p-8 text-center transition-colors cursor-pointer", dragging ? "border-cyan-500 bg-cyan-500/5" : "border-white/10 hover:border-white/20")}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} onClick={() => ref.current?.click()}>
        <Upload size={32} className="mx-auto text-gray-600 mb-3" />
        <p className="text-sm text-gray-400 mb-1">{file ? file.name : "Drop Excel file or click to browse"}</p>
        <p className="text-xs text-gray-600">.xlsx or .xls files</p>
        <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => setFile(e.target.files[0])} />
      </div>
      {hint && <p className="text-xs text-gray-600 mt-3 bg-white/[0.02] p-3 rounded-xl">{hint}</p>}
      <div className="flex gap-3 justify-end mt-4">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!file} onClick={() => onImport(file)} icon={Upload}>Import</Btn>
      </div>
    </Modal>
  );
};

// ─── ATTENDANCE PAGE ─────────────────────────────
const AttendancePage = ({ employees, attendance, setAttendance, canEdit, toast, loadAttendance }) => {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => { loadAttendance(selMonth, selYear); }, [selMonth, selYear]);

  const empAttendance = useMemo(() => {
    const map = {};
    attendance.forEach(a => {
      if (!map[a.employee_id]) map[a.employee_id] = {};
      map[a.employee_id][a.date] = a;
    });
    return map;
  }, [attendance]);

  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(selYear, selMonth - 1, i + 1);
    return { date: d.toISOString().split("T")[0], day: i + 1, weekday: ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()], isSunday: d.getDay() === 0 };
  });

  const filteredEmps = employees.filter(e => e.status === "active" && (!search || e.name.toLowerCase().includes(search.toLowerCase())));

  const getStatusChar = (status) => {
    const m = { present: "P", absent: "A", half_day: "H", leave: "L", holiday: "●" };
    return m[status] || "—";
  };
  const getStatusColor = (status) => {
    const m = { present: "text-emerald-400", absent: "text-red-400", half_day: "text-amber-400", leave: "text-blue-400", holiday: "text-purple-400" };
    return m[status] || "text-gray-700";
  };

  const handleImport = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      const records = [];
      for (const r of rows) {
        const empCode = String(r["Employee Code"] || r["Code"] || r["employee_code"] || "").trim();
        const emp = employees.find(e => e.employee_code === empCode);
        if (!emp) continue;

        const date = r["Date"] || r["date"];
        const checkIn = r["Check In"] || r["In"] || r["check_in"] || null;
        const checkOut = r["Check Out"] || r["Out"] || r["check_out"] || null;
        const status = (r["Status"] || r["status"] || "present").toLowerCase().replace(" ", "_");

        if (date) {
          let dateStr = date;
          if (typeof date === "number") {
            const d = new Date((date - 25569) * 86400 * 1000);
            dateStr = d.toISOString().split("T")[0];
          }
          records.push({ employee_id: emp.id, date: dateStr, check_in: checkIn, check_out: checkOut, status });
        }
      }

      if (records.length === 0) { toast("No valid records found.", "error"); return; }

      await supabase.upsert("att_attendance", records);
      await supabase.insert("att_import_logs", { import_type: "attendance", file_name: file.name, records_imported: records.length });
      toast(`Imported ${records.length} attendance records!`, "success");
      loadAttendance(selMonth, selYear);
      setShowImport(false);
    } catch (err) { toast(`Import failed: ${err.message}`, "error"); }
  };

  const handleManualSave = async (record) => {
    try {
      await supabase.upsert("att_attendance", [record]);
      toast("Attendance saved!", "success");
      loadAttendance(selMonth, selYear);
      setShowManual(false);
    } catch (err) { toast(err.message, "error"); }
  };

  const handlePrint = () => {
    const headers = ["Employee", ...dates.map(d => d.day), "P", "A", "H", "L"];
    const rows = filteredEmps.map(e => {
      const att = empAttendance[e.id] || {};
      let p = 0, a = 0, h = 0, l = 0;
      const dayCells = dates.map(d => {
        const rec = att[d.date];
        if (rec?.status === "present") p++;
        else if (rec?.status === "absent") a++;
        else if (rec?.status === "half_day") h++;
        else if (rec?.status === "leave") l++;
        return rec ? getStatusChar(rec.status) : (d.isSunday ? "●" : "—");
      });
      return [e.name, ...dayCells, p, a, h, l];
    });
    printTable(`Attendance - ${MONTH_FULL[selMonth - 1]} ${selYear}`, headers, rows);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input icon={Search} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          <Select options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} value={selMonth} onChange={e => setSelMonth(+e.target.value)} />
          <Select options={[2024,2025,2026,2027].map(y => ({ value: y, label: y }))} value={selYear} onChange={e => setSelYear(+e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" icon={Printer} onClick={handlePrint}>Print</Btn>
          {canEdit && <Btn variant="secondary" size="sm" icon={Upload} onClick={() => setShowImport(true)}>Import</Btn>}
          {canEdit && <Btn size="sm" icon={Plus} onClick={() => setShowManual(true)}>Mark</Btn>}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {[["P","Present","emerald"],["A","Absent","red"],["H","Half Day","amber"],["L","Leave","blue"],["●","Sunday/Holiday","purple"]].map(([c,l,color]) => (
          <span key={c} className="flex items-center gap-1.5"><span className={`text-${color}-400 font-bold`}>{c}</span><span className="text-gray-500">{l}</span></span>
        ))}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs min-w-max">
            <thead><tr className="bg-white/[0.02]">
              <th className="px-3 py-2 text-left text-gray-500 font-medium sticky left-0 bg-[#0d0d14] z-10 min-w-[140px]">Employee</th>
              {dates.map(d => (
                <th key={d.date} className={cn("px-1.5 py-2 text-center min-w-[28px] font-medium", d.isSunday ? "text-purple-500 bg-purple-500/5" : "text-gray-500")}>
                  <div>{d.day}</div>
                  <div className="text-[9px] font-normal">{d.weekday}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-center text-emerald-500 font-medium">P</th>
              <th className="px-2 py-2 text-center text-red-500 font-medium">A</th>
            </tr></thead>
            <tbody>
              {filteredEmps.length === 0 ? (
                <tr><td colSpan={dates.length + 3} className="text-center py-8 text-gray-600">No employees found</td></tr>
              ) : filteredEmps.map(e => {
                const att = empAttendance[e.id] || {};
                let pCount = 0, aCount = 0;
                return (
                  <tr key={e.id} className="border-t border-white/[0.02] hover:bg-white/[0.01]">
                    <td className="px-3 py-2 text-gray-300 font-medium sticky left-0 bg-[#0a0a0f] z-10">{e.name}</td>
                    {dates.map(d => {
                      const rec = att[d.date];
                      if (rec?.status === "present") pCount++;
                      if (rec?.status === "absent") aCount++;
                      return (
                        <td key={d.date} className={cn("px-1.5 py-2 text-center font-bold", d.isSunday && "bg-purple-500/5",
                          rec ? getStatusColor(rec.status) : (d.isSunday ? "text-purple-500/40" : "text-gray-800"))}>
                          {rec ? getStatusChar(rec.status) : (d.isSunday ? "●" : "—")}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center text-emerald-400 font-bold">{pCount}</td>
                    <td className="px-2 py-2 text-center text-red-400 font-bold">{aCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ImportModal open={showImport} onClose={() => setShowImport(false)} onImport={handleImport} title="Import Attendance"
        hint="Excel columns: Employee Code, Date (YYYY-MM-DD), Check In (HH:MM), Check Out (HH:MM), Status (present/absent/half_day/leave)" />

      <ManualAttendanceModal open={showManual} onClose={() => setShowManual(false)} employees={employees} onSave={handleManualSave} />
    </div>
  );
};

const ManualAttendanceModal = ({ open, onClose, employees, onSave }) => {
  const [form, setForm] = useState({ employee_id: "", date: new Date().toISOString().split("T")[0], check_in: "09:00", check_out: "18:00", status: "present" });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Mark Attendance">
      <div className="space-y-4">
        <Select label="Employee" options={[{ value: "", label: "Select Employee" }, ...employees.filter(e=>e.status==="active").map(e => ({ value: e.id, label: `${e.name} (${e.employee_code})` }))]}
          value={form.employee_id} onChange={e => set("employee_id", e.target.value)} />
        <Input label="Date" type="date" value={form.date} onChange={e => set("date", e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Check In" type="time" value={form.check_in} onChange={e => set("check_in", e.target.value)} />
          <Input label="Check Out" type="time" value={form.check_out} onChange={e => set("check_out", e.target.value)} />
        </div>
        <Select label="Status" options={[{value:"present",label:"Present"},{value:"absent",label:"Absent"},{value:"half_day",label:"Half Day"},{value:"leave",label:"Leave"},{value:"holiday",label:"Holiday"}]}
          value={form.status} onChange={e => set("status", e.target.value)} />
      </div>
      <div className="flex gap-3 justify-end mt-6">
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn disabled={!form.employee_id} onClick={() => onSave(form)}>Save</Btn>
      </div>
    </Modal>
  );
};

// ─── SALARY PAGE ─────────────────────────────
const SalaryPage = ({ employees, salaryRecords, setSalaryRecords, workSettings, canEdit, isSuperAdmin, toast, loadSalaryRecords, loadData }) => {
  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1);
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [calculating, setCalculating] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => { loadSalaryRecords(selMonth, selYear); }, [selMonth, selYear]);

  const calculateSalaries = async () => {
    setCalculating(true);
    try {
      const activeEmps = employees.filter(e => e.status === "active");
      const ws = workSettings.find(w => w.month === selMonth && w.year === selYear);
      const workingDays = ws?.total_working_days || 26;
      const workHrsPerDay = ws?.work_hours_per_day || 8;
      const overtimeRate = ws?.overtime_rate || 1.5;

      const startDate = `${selYear}-${String(selMonth).padStart(2,"0")}-01`;
      const endMonth = selMonth === 12 ? 1 : selMonth + 1;
      const endYear = selMonth === 12 ? selYear + 1 : selYear;
      const endDate = `${endYear}-${String(endMonth).padStart(2,"0")}-01`;

      const attData = await supabase.query("att_attendance", {
        filters: [`date=gte.${startDate}`, `date=lt.${endDate}`], order: "date.asc"
      });

      const attMap = {};
      (attData || []).forEach(a => {
        if (!attMap[a.employee_id]) attMap[a.employee_id] = [];
        attMap[a.employee_id].push(a);
      });

      const records = activeEmps.map(emp => {
        const empAtt = attMap[emp.id] || [];
        const daysPresent = empAtt.filter(a => a.status === "present").length;
        const daysAbsent = empAtt.filter(a => a.status === "absent").length;
        const daysHalfDay = empAtt.filter(a => a.status === "half_day").length;
        const daysLeave = empAtt.filter(a => a.status === "leave").length;
        const totalHours = empAtt.reduce((s, a) => s + (parseFloat(a.total_hours) || 0), 0);

        const perDaySalary = parseFloat(emp.base_salary) / workingDays;
        const effectiveDays = daysPresent + (daysHalfDay * 0.5) + daysLeave;
        const earnedSalary = perDaySalary * effectiveDays;
        const expectedHours = effectiveDays * workHrsPerDay;
        const overtimeHours = Math.max(0, totalHours - expectedHours);
        const overtimePay = overtimeHours * (perDaySalary / workHrsPerDay) * overtimeRate;
        const netSalary = earnedSalary + overtimePay;

        return {
          employee_id: emp.id, month: selMonth, year: selYear,
          base_salary: parseFloat(emp.base_salary), days_present: daysPresent, days_absent: daysAbsent,
          days_half_day: daysHalfDay, days_leave: daysLeave, total_hours_worked: Math.round(totalHours * 100) / 100,
          overtime_hours: Math.round(overtimeHours * 100) / 100, per_day_salary: Math.round(perDaySalary * 100) / 100,
          earned_salary: Math.round(earnedSalary * 100) / 100, overtime_pay: Math.round(overtimePay * 100) / 100,
          deductions: 0, bonus: 0, net_salary: Math.round(netSalary * 100) / 100,
          status: "calculated", calculated_at: new Date().toISOString()
        };
      });

      await supabase.upsert("att_salary_records", records);

      // Create notifications
      const notifs = activeEmps.map(emp => ({
        employee_id: emp.id, target_email: emp.email,
        title: "Salary Calculated",
        message: `Your salary for ${MONTH_FULL[selMonth - 1]} ${selYear} has been calculated.`,
        type: "salary_calculated"
      }));
      await supabase.insert("att_notifications", notifs);

      toast(`Salary calculated for ${records.length} employees!`, "success");
      loadSalaryRecords(selMonth, selYear);
      loadData();
    } catch (err) { toast(`Calculation failed: ${err.message}`, "error"); }
    setCalculating(false);
  };

  const updateStatus = async (record, newStatus) => {
    try {
      await supabase.update("att_salary_records", { status: newStatus, updated_at: new Date().toISOString() }, [`id=eq.${record.id}`]);
      toast(`Status updated to ${newStatus}!`, "success");
      loadSalaryRecords(selMonth, selYear);
    } catch (err) { toast(err.message, "error"); }
  };

  const filtered = useMemo(() => {
    return salaryRecords.filter(s => {
      const emp = employees.find(e => e.id === s.employee_id);
      if (search && emp && !emp.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [salaryRecords, search, statusFilter, employees]);

  const totalNet = filtered.reduce((s, r) => s + (parseFloat(r.net_salary) || 0), 0);

  const handlePrint = () => {
    printTable(`Salary Report - ${MONTH_FULL[selMonth - 1]} ${selYear}`,
      ["Employee", "Base", "Days Present", "Days Absent", "Hours Worked", "Earned", "OT Pay", "Net Salary", "Status"],
      filtered.map(s => {
        const emp = employees.find(e => e.id === s.employee_id);
        return [emp?.name || "—", fmt(s.base_salary), s.days_present, s.days_absent, s.total_hours_worked, fmt(s.earned_salary), fmt(s.overtime_pay), fmt(s.net_salary), s.status];
      })
    );
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map(s => {
      const emp = employees.find(e => e.id === s.employee_id);
      return {
        "Employee": emp?.name, "Code": emp?.employee_code, "Month": MONTH_FULL[selMonth - 1], "Year": selYear,
        "Base Salary": s.base_salary, "Days Present": s.days_present, "Days Absent": s.days_absent,
        "Half Days": s.days_half_day, "Leave Days": s.days_leave, "Hours Worked": s.total_hours_worked,
        "Overtime Hours": s.overtime_hours, "Earned Salary": s.earned_salary, "Overtime Pay": s.overtime_pay,
        "Deductions": s.deductions, "Bonus": s.bonus, "Net Salary": s.net_salary, "Status": s.status
      };
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Salary");
    XLSX.writeFile(wb, `salary_${MONTH_FULL[selMonth-1]}_${selYear}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Input icon={Search} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
          <Select options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} value={selMonth} onChange={e => setSelMonth(+e.target.value)} />
          <Select options={[2024,2025,2026,2027].map(y => ({ value: y, label: y }))} value={selYear} onChange={e => setSelYear(+e.target.value)} />
          <Select options={[{value:"all",label:"All Status"},{value:"draft",label:"Draft"},{value:"calculated",label:"Calculated"},{value:"approved",label:"Approved"},{value:"paid",label:"Paid"}]}
            value={statusFilter} onChange={e => setStatusFilter(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Btn variant="ghost" size="sm" icon={Printer} onClick={handlePrint}>Print</Btn>
          <Btn variant="ghost" size="sm" icon={Download} onClick={handleExport}>Export</Btn>
          {canEdit && <Btn size="sm" icon={Calculator} onClick={calculateSalaries} disabled={calculating}>
            {calculating ? "Calculating..." : "Calculate Salary"}
          </Btn>}
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Employees" value={filtered.length} color="cyan" />
          <StatCard icon={DollarSign} label="Total Payout" value={fmt(totalNet)} color="emerald" />
          <StatCard icon={Check} label="Approved" value={filtered.filter(s=>s.status==="approved"||s.status==="paid").length} color="green" />
          <StatCard icon={Clock} label="Pending" value={filtered.filter(s=>s.status==="calculated"||s.status==="draft").length} color="amber" />
        </div>
      )}

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-white/[0.02]">
              {["Employee","Base","Days (P/A/H)","Hours","Earned","OT","Net Salary","Status",""].map(h => (
                <th key={h} className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon={DollarSign} title="No salary records" subtitle="Calculate salary for this month"
                  action={canEdit && <Btn size="sm" icon={Calculator} onClick={calculateSalaries}>Calculate Now</Btn>} /></td></tr>
              ) : filtered.map(s => {
                const emp = employees.find(e => e.id === s.employee_id);
                return (
                  <tr key={s.id} className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{emp?.name || "—"}</p>
                      <p className="text-gray-600 text-xs">{emp?.employee_code}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{fmt(s.base_salary)}</td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-400">{s.days_present}</span> / <span className="text-red-400">{s.days_absent}</span> / <span className="text-amber-400">{s.days_half_day}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{s.total_hours_worked}h</td>
                    <td className="px-4 py-3 text-gray-300">{fmt(s.earned_salary)}</td>
                    <td className="px-4 py-3 text-cyan-400">{s.overtime_pay > 0 ? fmt(s.overtime_pay) : "—"}</td>
                    <td className="px-4 py-3 text-white font-semibold">{fmt(s.net_salary)}</td>
                    <td className="px-4 py-3"><Badge color={s.status}>{s.status}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => setViewRecord(s)} className="p-1.5 hover:bg-white/5 rounded-lg"><Eye size={14} className="text-gray-500" /></button>
                        {canEdit && s.status === "calculated" && <button onClick={() => updateStatus(s, "approved")} className="p-1.5 hover:bg-emerald-500/10 rounded-lg" title="Approve"><Check size={14} className="text-emerald-500" /></button>}
                        {canEdit && s.status === "approved" && <button onClick={() => updateStatus(s, "paid")} className="p-1.5 hover:bg-green-500/10 rounded-lg" title="Mark Paid"><DollarSign size={14} className="text-green-500" /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-white/[0.03] flex justify-between text-sm">
            <span className="text-gray-500">{filtered.length} records</span>
            <span className="text-white font-semibold">Total: {fmt(totalNet)}</span>
          </div>
        )}
      </Card>

      {/* Salary Slip Modal */}
      <Modal open={!!viewRecord} onClose={() => setViewRecord(null)} title="Salary Slip" wide>
        {viewRecord && (() => {
          const emp = employees.find(e => e.id === viewRecord.employee_id);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-white/[0.02] rounded-xl">
                <div><p className="text-xs text-gray-500">Employee</p><p className="text-white font-medium">{emp?.name}</p></div>
                <div><p className="text-xs text-gray-500">Code</p><p className="text-white">{emp?.employee_code}</p></div>
                <div><p className="text-xs text-gray-500">Month</p><p className="text-white">{MONTH_FULL[viewRecord.month - 1]} {viewRecord.year}</p></div>
                <div><p className="text-xs text-gray-500">Status</p><Badge color={viewRecord.status}>{viewRecord.status}</Badge></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Days Present", viewRecord.days_present, "emerald"], ["Days Absent", viewRecord.days_absent, "red"],
                  ["Half Days", viewRecord.days_half_day, "amber"], ["Leave Days", viewRecord.days_leave, "blue"]
                ].map(([l, v, c]) => (
                  <div key={l} className="text-center p-3 bg-white/[0.02] rounded-xl">
                    <p className={`text-2xl font-bold text-${c}-400`}>{v}</p>
                    <p className="text-xs text-gray-500 mt-1">{l}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 p-4 bg-white/[0.02] rounded-xl">
                {[["Base Salary", fmt(viewRecord.base_salary)], ["Per Day Salary", fmtDec(viewRecord.per_day_salary)],
                  ["Hours Worked", `${viewRecord.total_hours_worked}h`], ["Overtime Hours", `${viewRecord.overtime_hours}h`],
                  ["Earned Salary", fmt(viewRecord.earned_salary)], ["Overtime Pay", fmt(viewRecord.overtime_pay)],
                  ["Deductions", fmt(viewRecord.deductions)], ["Bonus", fmt(viewRecord.bonus)]
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-sm"><span className="text-gray-500">{l}</span><span className="text-gray-300">{v}</span></div>
                ))}
                <div className="flex justify-between text-base font-bold border-t border-white/10 pt-2 mt-2">
                  <span className="text-white">Net Salary</span>
                  <span className="text-emerald-400">{fmt(viewRecord.net_salary)}</span>
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <Btn variant="secondary" icon={Printer} onClick={() => {
                  printTable(`Salary Slip - ${emp?.name} - ${MONTH_FULL[viewRecord.month - 1]} ${viewRecord.year}`,
                    ["Detail", "Value"],
                    [["Employee", emp?.name], ["Code", emp?.employee_code], ["Month", `${MONTH_FULL[viewRecord.month-1]} ${viewRecord.year}`],
                     ["Base Salary", fmt(viewRecord.base_salary)], ["Days Present", viewRecord.days_present], ["Days Absent", viewRecord.days_absent],
                     ["Hours Worked", viewRecord.total_hours_worked], ["Earned Salary", fmt(viewRecord.earned_salary)],
                     ["Overtime Pay", fmt(viewRecord.overtime_pay)], ["Deductions", fmt(viewRecord.deductions)], ["Net Salary", fmt(viewRecord.net_salary)]]
                  );
                }}>Print Slip</Btn>
                <Btn variant="secondary" onClick={() => setViewRecord(null)}>Close</Btn>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

// ─── NOTIFICATIONS PAGE ─────────────────────────
const NotificationsPage = ({ notifications, setNotifications, toast }) => {
  const markRead = async (id) => {
    try {
      await supabase.update("att_notifications", { is_read: true }, [`id=eq.${id}`]);
      setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    } catch (err) { toast(err.message, "error"); }
  };

  const markAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.is_read);
      for (const n of unread) {
        await supabase.update("att_notifications", { is_read: true }, [`id=eq.${n.id}`]);
      }
      setNotifications(ns => ns.map(n => ({ ...n, is_read: true })));
      toast("All marked as read!", "success");
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Notifications</h2>
        {notifications.some(n => !n.is_read) && <Btn variant="ghost" size="sm" onClick={markAllRead}>Mark all read</Btn>}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" subtitle="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <Card key={n.id} className={cn("!p-4 flex items-start gap-4", !n.is_read && "!border-cyan-500/20 !bg-cyan-500/[0.03]")} hover onClick={() => !n.is_read && markRead(n.id)}>
              <div className={cn("p-2 rounded-xl shrink-0", n.type === "salary_calculated" ? "bg-cyan-500/10" : n.type === "salary_paid" ? "bg-emerald-500/10" : "bg-gray-500/10")}>
                {n.type === "salary_calculated" ? <Calculator size={16} className="text-cyan-400" /> :
                 n.type === "salary_paid" ? <DollarSign size={16} className="text-emerald-400" /> :
                 <Bell size={16} className="text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  {!n.is_read && <div className="w-2 h-2 bg-cyan-500 rounded-full" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                <p className="text-[10px] text-gray-700 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── SETTINGS PAGE ─────────────────────────────
const SettingsPage = ({ workSettings, setWorkSettings, profile, canEdit, isSuperAdmin, toast, loadData }) => {
  const now = new Date();
  const [wsMonth, setWsMonth] = useState(now.getMonth() + 1);
  const [wsYear, setWsYear] = useState(now.getFullYear());
  const [wsForm, setWsForm] = useState({ total_working_days: 26, work_hours_per_day: 8, overtime_rate: 1.5, half_day_hours: 4 });
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("viewer");
  const [tab, setTab] = useState("work");

  useEffect(() => {
    const existing = workSettings.find(w => w.month === wsMonth && w.year === wsYear);
    if (existing) setWsForm({ total_working_days: existing.total_working_days, work_hours_per_day: existing.work_hours_per_day, overtime_rate: existing.overtime_rate, half_day_hours: existing.half_day_hours });
    else setWsForm({ total_working_days: 26, work_hours_per_day: 8, overtime_rate: 1.5, half_day_hours: 4 });
  }, [wsMonth, wsYear, workSettings]);

  useEffect(() => {
    if (isSuperAdmin) {
      supabase.query("profiles", { order: "created_at.asc" }).then(setUsers).catch(console.error);
    }
  }, [isSuperAdmin]);

  const saveWorkSettings = async () => {
    try {
      await supabase.upsert("att_work_settings", [{ month: wsMonth, year: wsYear, ...wsForm, updated_at: new Date().toISOString() }]);
      toast("Work settings saved!", "success");
      loadData();
    } catch (err) { toast(err.message, "error"); }
  };

  const updateUserRole = async (userId, role) => {
    try {
      await supabase.update("profiles", { role }, [`id=eq.${userId}`]);
      setUsers(u => u.map(x => x.id === userId ? { ...x, role } : x));
      toast("Role updated!", "success");
    } catch (err) { toast(err.message, "error"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-white/5 pb-2">
        {[["work", "Work Settings", Clock], ["users", "User Management", Users]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all",
            tab === id ? "bg-cyan-500/10 text-cyan-400 font-medium" : "text-gray-500 hover:text-gray-300")}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "work" && (
        <Card>
          <h3 className="text-base font-semibold mb-4">Monthly Work Configuration</h3>
          <div className="flex gap-2 mb-4">
            <Select options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} value={wsMonth} onChange={e => setWsMonth(+e.target.value)} />
            <Select options={[2024,2025,2026,2027].map(y => ({ value: y, label: y }))} value={wsYear} onChange={e => setWsYear(+e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Total Working Days" type="number" value={wsForm.total_working_days} onChange={e => setWsForm(f => ({...f, total_working_days: +e.target.value}))} />
            <Input label="Work Hours Per Day" type="number" step="0.5" value={wsForm.work_hours_per_day} onChange={e => setWsForm(f => ({...f, work_hours_per_day: +e.target.value}))} />
            <Input label="Overtime Rate (x)" type="number" step="0.1" value={wsForm.overtime_rate} onChange={e => setWsForm(f => ({...f, overtime_rate: +e.target.value}))} />
            <Input label="Half Day Hours" type="number" step="0.5" value={wsForm.half_day_hours} onChange={e => setWsForm(f => ({...f, half_day_hours: +e.target.value}))} />
          </div>
          {canEdit && <Btn className="mt-4" onClick={saveWorkSettings}>Save Settings</Btn>}
        </Card>
      )}

      {tab === "users" && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">Users & Roles</h3>
          </div>
          <p className="text-xs text-gray-600 mb-4 bg-white/[0.02] p-3 rounded-xl">
            <strong>Super Admin</strong> — Full access, can delete data &amp; manage users &nbsp;|&nbsp; <strong>Admin</strong> — Can add/edit data, cannot delete &nbsp;|&nbsp; <strong>Viewer</strong> — Read-only access
          </p>
          <div className="space-y-2">
            {users.map(u => {
              const RIcon = ROLE_ICONS[u.role] || Shield;
              return (
                <div key={u.id} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">
                      {(u.full_name || u.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white">{u.full_name || u.email}</p>
                      <p className="text-xs text-gray-600">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RIcon size={14} className={ROLE_COLORS[u.role]} />
                    {isSuperAdmin && u.id !== profile?.id ? (
                      <select className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        value={u.role} onChange={e => updateUserRole(u.id, e.target.value)}>
                        <option value="viewer" className="bg-gray-900">Viewer</option>
                        <option value="admin" className="bg-gray-900">Admin</option>
                        <option value="super_admin" className="bg-gray-900">Super Admin</option>
                      </select>
                    ) : (
                      <span className={cn("text-xs capitalize", ROLE_COLORS[u.role])}>{u.role?.replace("_", " ")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {!isSuperAdmin && <p className="text-xs text-gray-600 mt-4 text-center">Only Super Admins can manage user roles.</p>}
        </Card>
      )}
    </div>
  );
};
