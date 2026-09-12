import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import StatCard from "./shared/StatCard";

export default function Reports() {
  const [stats, setStats] = useState({
    users: 0,
    deposits: 0,
    withdrawals: 0,
    trades: 0,
    volume: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { count: users },
        { data: deps },
        { data: wds },
        { count: trades },
        { data: tradeRows },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("deposits").select("amount"),
        supabase.from("withdrawals").select("amount"),
        supabase.from("trades").select("*", { count: "exact", head: true }),
        supabase.from("trades").select("price, amount"),
      ]);

      const depTotal = (deps ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const wdTotal = (wds ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      const vol = (tradeRows ?? []).reduce((s: number, r: any) => s + Number(r.price || 0) * Number(r.amount || 0), 0);

      setStats({
        users: users ?? 0,
        deposits: depTotal,
        withdrawals: wdTotal,
        trades: trades ?? 0,
        volume: vol,
      });
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <div style={{ color: "#666", padding: 40, textAlign: "center" }}>Loading reports…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard label="Total Users" value={stats.users} />
        <StatCard label="Total Deposits" value={`$${stats.deposits.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} color="#22c55e" />
        <StatCard label="Total Withdrawals" value={`$${stats.withdrawals.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} color="#ef4444" />
        <StatCard label="Total Trades" value={stats.trades} color="#3b82f6" />
        <StatCard label="Trade Volume" value={`$${stats.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} color="#a855f7" />
      </div>
      <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 14, padding: 20, color: "#888", fontSize: 13 }}>
        Reports are generated live from the database. Export functionality can be added later via the reports / report_exports tables.
      </div>
    </div>
  );
}
