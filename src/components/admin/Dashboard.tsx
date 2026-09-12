import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import StatCard from "./shared/StatCard";

interface Counts {
  totalUsers: number;
  verifiedUsers: number;
  pendingKyc: number;
  bannedUsers: number;
  openTickets: number;
  merchantReqs: number;
  totalDeposits: number;
  totalWithdrawals: number;
}

interface Activity {
  id: string;
  event_type: string;
  description: string;
  created_at: string;
}

export default function Dashboard() {
  const [counts, setCounts] = useState<Counts>({
    totalUsers: 0,
    verifiedUsers: 0,
    pendingKyc: 0,
    bannedUsers: 0,
    openTickets: 0,
    merchantReqs: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
  });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [
        { count: totalUsers },
        { count: verifiedUsers },
        { count: pendingKyc },
        { count: bannedUsers },
        { count: openTickets },
        { count: merchantReqs },
        { data: deposits },
        { data: withdrawals },
        { data: logs },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("kyc_status", "VERIFIED"),
        supabase.from("kyc_submissions").select("*", { count: "exact", head: true }).eq("status", "PENDING"),
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_banned", true),
        supabase.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("merchant_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("deposits").select("amount"),
        supabase.from("withdrawals").select("amount"),
        supabase.from("admin_activity_log").select("id, event_type, description, created_at").order("created_at", { ascending: false }).limit(20),
      ]);

      if (!alive) return;

      const totalDep = (deposits ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const totalWd = (withdrawals ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

      setCounts({
        totalUsers: totalUsers ?? 0,
        verifiedUsers: verifiedUsers ?? 0,
        pendingKyc: pendingKyc ?? 0,
        bannedUsers: bannedUsers ?? 0,
        openTickets: openTickets ?? 0,
        merchantReqs: merchantReqs ?? 0,
        totalDeposits: totalDep,
        totalWithdrawals: totalWd,
      });
      setActivity((logs as Activity[]) ?? []);
      setLoading(false);
    }

    void load();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <div style={{ color: "#666", padding: 40, textAlign: "center" }}>Loading dashboard…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="Total Users" value={counts.totalUsers} sub="All Time" />
        <StatCard label="Verified Users" value={counts.verifiedUsers} sub="KYC Verified" color="#22c55e" />
        <StatCard label="Pending KYC" value={counts.pendingKyc} sub="Needs Attention" color="#f59e0b" />
        <StatCard label="Banned Users" value={counts.bannedUsers} sub="Restricted" color="#ef4444" />
        <StatCard label="Open Tickets" value={counts.openTickets} sub="Requires Response" color="#3b82f6" />
        <StatCard label="Merchant Reqs" value={counts.merchantReqs} sub="Pending Review" color="#a855f7" />
        <StatCard label="Total Deposits" value={`$${counts.totalDeposits.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
        <StatCard label="Total Withdrawals" value={`$${counts.totalWithdrawals.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} />
      </div>

      <div
        style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: 14,
          padding: 20,
        }}
      >
        <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "#fff" }}>
          Recent Activity
        </h3>
        {activity.length === 0 ? (
          <div style={{ color: "#555", fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No recent activity
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {activity.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: "#111",
                  borderRadius: 8,
                  border: "1px solid #1f1f1f",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: "#ddd" }}>{a.description || a.event_type}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{a.event_type}</div>
                </div>
                <div style={{ fontSize: 11, color: "#555", whiteSpace: "nowrap" }}>
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
