import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AccountType, WalletRow } from "../lib/types";
import { resolveAccountType } from "../lib/format";

export type AccountBalanceMap = Record<
  AccountType,
  { asset: string; available: number; locked: number; total: number }[]
>;

const EMPTY: AccountBalanceMap = {
  spot: [],
  funding: [],
  futures: [],
  earn: [],
};

/**
 * Loads real wallet rows and groups them by internal account_type.
 * Does NOT invent balances. Prefers account_type; falls back to wallet_type mapping.
 */
export function useAccountBalances(userId: string | null) {
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    // Select both columns so we work with current and future schema
    const { data, error: e } = await supabase
      .from("wallets")
      .select(
        "id,user_id,asset,balance,locked_balance,escrow_balance,account_type,wallet_type,status"
      )
      .eq("user_id", userId);

    if (e) {
      // Fallback if account_type column does not exist yet
      const fallback = await supabase
        .from("wallets")
        .select(
          "id,user_id,asset,balance,locked_balance,escrow_balance,wallet_type,status"
        )
        .eq("user_id", userId);
      if (fallback.error) {
        setError(fallback.error.message);
        setRows([]);
      } else {
        setRows((fallback.data as WalletRow[]) ?? []);
      }
    } else {
      setRows((data as WalletRow[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`wallets-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wallets",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const byAccount = useMemo((): AccountBalanceMap => {
    const map: AccountBalanceMap = {
      spot: [],
      funding: [],
      futures: [],
      earn: [],
    };
    for (const w of rows) {
      const type = resolveAccountType(w);
      if (type === "unknown") continue;
      const available = Number(w.balance) || 0;
      const locked =
        (Number(w.locked_balance) || 0) + (Number(w.escrow_balance) || 0);
      map[type].push({
        asset: (w.asset || "").toUpperCase(),
        available,
        locked,
        total: available + locked,
      });
    }
    // Aggregate same asset within an account type
    (Object.keys(map) as AccountType[]).forEach((key) => {
      const agg = new Map<
        string,
        { asset: string; available: number; locked: number; total: number }
      >();
      for (const row of map[key]) {
        const prev = agg.get(row.asset);
        if (prev) {
          prev.available += row.available;
          prev.locked += row.locked;
          prev.total += row.total;
        } else {
          agg.set(row.asset, { ...row });
        }
      }
      map[key] = Array.from(agg.values()).sort((a, b) =>
        a.asset.localeCompare(b.asset)
      );
    });
    return map;
  }, [rows]);

  const totals = useMemo(() => {
    const t: Record<AccountType, number> = {
      spot: 0,
      funding: 0,
      futures: 0,
      earn: 0,
    };
    (Object.keys(byAccount) as AccountType[]).forEach((k) => {
      t[k] = byAccount[k].reduce((s, r) => s + r.total, 0);
    });
    return t;
  }, [byAccount]);

  return {
    rows,
    byAccount,
    totals,
    loading,
    error,
    refresh: load,
    empty: EMPTY,
  };
}
