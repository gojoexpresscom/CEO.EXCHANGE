import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { AdminProfile, AdminSection } from "./shared/types";
import Dashboard from "./Dashboard";
import Users from "./Users";
import KycVerification from "./KycVerification";
import Merchants from "./Merchants";
import Transactions from "./Transactions";
import Tickets from "./Tickets";
import Announcements from "./Announcements";
import Giveaways from "./Giveaways";
import Reports from "./Reports";
import Settings from "./Settings";
import RolesPermissions from "./RolesPermissions";
import Logs from "./Logs";
import PlatformIncome from "./finance/PlatformIncome";
import Withdrawals from "./finance/Withdrawals";
import DepositRecords from "./finance/DepositRecords";
import FeesCharges from "./finance/FeesCharges";
import P2PDisputes from "./P2PDisputes";

const NAV_ITEMS: { id: AdminSection; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "⊞" },
  { id: "users", label: "Users", icon: "👤" },
  { id: "kyc", label: "KYC Verification", icon: "🛡" },
  { id: "merchants", label: "Merchants", icon: "🏪" },
  { id: "transactions", label: "Transactions", icon: "⇄" },
  { id: "tickets", label: "Tickets", icon: "🎫" },
  { id: "announcements", label: "Announcements", icon: "📢" },
  { id: "giveaways", label: "Giveaways", icon: "🎁" },
  { id: "reports", label: "Reports", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙" },
  { id: "roles", label: "Roles & Permissions", icon: "🔑" },
  { id: "logs", label: "Logs", icon: "📋" },
];

const FINANCE_ITEMS: { id: AdminSection; label: string }[] = [
  { id: "finance-income", label: "Platform Income" },
  { id: "finance-withdrawals", label: "Withdrawals" },
  { id: "finance-deposits", label: "Deposit Records" },
  { id: "finance-fees", label: "Fees & Charges" },
];

export default function AdminPortal() {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || !alive) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, email, role, nickname")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!alive) return;
      if (data) {
        setProfile({
          id: data.id,
          email: data.email,
          role: data.role,
          nickname: data.nickname,
        });
      }
      setLoadingProfile(false);
    }

    void loadProfile();
    return () => { alive = false; };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  function renderSection() {
    switch (section) {
      case "dashboard": return <Dashboard />;
      case "users": return <Users />;
      case "kyc": return <KycVerification />;
      case "merchants": return <Merchants />;
      case "transactions": return <Transactions />;
      case "tickets": return <Tickets />;
      case "announcements": return <Announcements />;
      case "giveaways": return <Giveaways />;
      case "reports": return <Reports />;
      case "settings": return <Settings />;
      case "roles": return <RolesPermissions />;
      case "logs": return <Logs />;
      case "finance-income": return <PlatformIncome />;
      case "finance-withdrawals": return <Withdrawals />;
      case "finance-deposits": return <DepositRecords />;
      case "finance-fees": return <FeesCharges />;
      case "p2p-disputes": return <P2PDisputes />;
      default: return <Dashboard />;
    }
  }

  const isFinance = section.startsWith("finance-");

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#050505",
        color: "#e5e5e5",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: sidebarCollapsed ? 72 : 240,
          background: "#0a0a0a",
          borderRight: "1px solid #1a1a1a",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s ease",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "20px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid #1a1a1a",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #f5b51b, #d4a017)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#000",
              fontSize: 16,
            }}
          >
            C
          </div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Admin Portal</div>
              <div style={{ fontSize: 11, color: "#666" }}>Limited Access</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
          {NAV_ITEMS.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: active ? "rgba(245,181,27,0.12)" : "transparent",
                  color: active ? "#f5b51b" : "#999",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}

          {/* Finance group */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setFinanceOpen(!financeOpen)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "none",
                background: isFinance ? "rgba(245,181,27,0.12)" : "transparent",
                color: isFinance ? "#f5b51b" : "#999",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: isFinance ? 600 : 400,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>💰</span>
              {!sidebarCollapsed && (
                <>
                  <span style={{ flex: 1 }}>Finance</span>
                  <span style={{ fontSize: 10 }}>{financeOpen ? "▼" : "▶"}</span>
                </>
              )}
            </button>
            {financeOpen && !sidebarCollapsed && (
              <div style={{ paddingLeft: 20, marginTop: 4 }}>
                {FINANCE_ITEMS.map((item) => {
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSection(item.id)}
                      style={{
                        width: "100%",
                        display: "block",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "none",
                        background: active ? "rgba(245,181,27,0.15)" : "transparent",
                        color: active ? "#f5b51b" : "#777",
                        cursor: "pointer",
                        fontSize: 13,
                        textAlign: "left",
                        marginBottom: 2,
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* P2P Disputes */}
          <button
            onClick={() => setSection("p2p-disputes")}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: section === "p2p-disputes" ? "rgba(245,181,27,0.12)" : "transparent",
              color: section === "p2p-disputes" ? "#f5b51b" : "#999",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: section === "p2p-disputes" ? 600 : 400,
              textAlign: "left",
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>⚖</span>
            {!sidebarCollapsed && <span>P2P Disputes</span>}
          </button>
        </nav>

        {/* Collapse + Logout */}
        <div style={{ padding: "12px 8px", borderTop: "1px solid #1a1a1a" }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              border: "1px solid #222",
              background: "transparent",
              color: "#777",
              cursor: "pointer",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            {sidebarCollapsed ? "→" : "← Collapse"}
          </button>
          <button
            onClick={handleLogout}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: 8,
              border: "none",
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {sidebarCollapsed ? "⏻" : "Logout"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header
          style={{
            height: 60,
            borderBottom: "1px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            background: "#0a0a0a",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#fff", textTransform: "capitalize" }}>
            {section.replace("finance-", "").replace("-", " ")}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {loadingProfile ? (
              <span style={{ color: "#666", fontSize: 13 }}>Loading…</span>
            ) : profile ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #f5b51b, #d4a017)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#000",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {(profile.email || "A")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                    {profile.email}
                  </div>
                  <div style={{ fontSize: 11, color: "#f5b51b", textTransform: "capitalize" }}>
                    {profile.role}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
