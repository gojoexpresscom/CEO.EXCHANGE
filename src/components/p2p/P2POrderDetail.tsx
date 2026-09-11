import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  MerchantReputation,
  P2POrder,
  P2PPaymentMethod,
  p2pTradeErrorMessage,
} from "../../lib/p2p-types";

type Props = {
  orderId: string;
  onBack?: () => void;
  onTradeCreated?: (tradeId: string) => void;
};

const css = `
.p2pod-page{min-height:100vh;background:#050505;color:#eee;font-family:Inter,ui-sans-serif,system-ui,sans-serif;padding-bottom:40px}
.p2pod-shell{width:min(620px,100%);margin:auto;padding:10px 14px 26px;box-sizing:border-box}
.p2pod-top{display:flex;align-items:center;gap:10px;min-height:48px}
.p2pod-back{width:38px;height:38px;border:1px solid #232323;border-radius:10px;background:#0a0a0a;color:#f4c542;cursor:pointer;font-size:18px;display:grid;place-items:center;flex-shrink:0}
.p2pod-title{font-size:17px;font-weight:700}
.p2pod-spacer{flex:1}
.p2pod-badge{border:1px solid #2a2a2a;background:#121212;color:#aaa;border-radius:999px;padding:4px 10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em}
.p2pod-badge.buy{border-color:#0d5c3d;color:#3ddc97}
.p2pod-badge.sell{border-color:#7a1c2c;color:#ff7688}
.p2pod-loading{padding:80px 0;text-align:center;color:#f4c542;font-size:13px}
.p2pod-error{margin:16px 0;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:9px;padding:12px;font-size:13px}
.p2pod-notfound{padding:80px 20px;text-align:center;color:#666;font-size:13px;line-height:1.7}
.p2pod-header-card{border:1px solid #202020;background:#070707;border-radius:16px;padding:16px;margin:14px 0}
.p2pod-merchant-row{display:flex;align-items:center;gap:12px}
.p2pod-avatar{width:44px;height:44px;border-radius:999px;background:linear-gradient(145deg,#2a2a2a,#141414);border:1px solid #2e2e2e;display:grid;place-items:center;font-size:15px;font-weight:700;color:#eee;flex-shrink:0}
.p2pod-merchant-name{font-weight:700;font-size:15.5px}
.p2pod-merchant-rep{color:#888;font-size:12px;margin-top:3px}
.p2pod-price-block{text-align:right;margin-left:auto}
.p2pod-price{font-size:22px;font-weight:800;color:#f4c542}
.p2pod-price-unit{font-size:11.5px;color:#888;font-weight:500}
.p2pod-stale{margin-top:10px;border:1px solid #5c4b1b;background:#171307;color:#d2bd73;border-radius:9px;padding:8px 10px;font-size:11.5px}
.p2pod-section{border:1px solid #202020;background:#070707;border-radius:16px;padding:16px;margin:14px 0}
.p2pod-section h3{margin:0 0 10px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:.03em;font-weight:700}
.p2pod-detail-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #171717;font-size:13.5px}
.p2pod-detail-row:last-child{border-bottom:0}
.p2pod-detail-row span:first-child{color:#888}
.p2pod-methods{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.p2pod-chip{border:1px solid #2a2a2a;background:#121212;color:#aaa;border-radius:999px;padding:4px 10px;font-size:11.5px}
.p2pod-label{display:flex;justify-content:space-between;color:#999;font-size:12px;margin:0 0 6px}
.p2pod-input-wrap{border:1px solid #232323;border-radius:10px;background:#0a0a0a}
.p2pod-input-wrap:focus-within{border-color:#d9a927}
.p2pod-input{width:100%;box-sizing:border-box;background:none;color:#eee;border:0;padding:12px;font-size:15px;outline:none}
.p2pod-hint{margin-top:6px;font-size:11.5px;color:#777}
.p2pod-methods-pick{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.p2pod-method-btn{width:100%;text-align:left;border:1px solid #232323;border-radius:10px;background:#0a0a0a;color:#ddd;padding:11px 12px;cursor:pointer;font-size:13px}
.p2pod-method-btn.active{border-color:#d9a927;color:#f4c542}
.p2pod-no-methods{margin-top:6px;border:1px solid #5c4b1b;background:#171307;color:#d2bd73;border-radius:9px;padding:10px;font-size:12px;line-height:1.5}
.p2pod-panel-error{margin:12px 0 0;border:1px solid #5b1d26;background:#1b080b;color:#ff9aa6;border-radius:9px;padding:10px;font-size:12.5px}
.p2pod-submit{width:100%;border:0;border-radius:12px;padding:15px;margin-top:16px;color:#fff;font-weight:800;font-size:15.5px;cursor:pointer}
.p2pod-submit.buy{background:#08a96b}
.p2pod-submit.sell{background:#e52d45}
.p2pod-submit:disabled{background:#242424;color:#666;cursor:not-allowed}
.p2pod-own-note{margin:14px 0;border:1px solid #232323;background:#0a0a0a;color:#999;border-radius:10px;padding:12px;font-size:12.5px;line-height:1.6;text-align:center}
.p2pod-result{text-align:center;padding:26px 6px}
.p2pod-result-icon{width:56px;height:56px;border-radius:999px;background:#08a96b;color:#fff;display:grid;place-items:center;margin:0 auto 16px;font-size:28px}
.p2pod-result-id{font-family:monospace;font-size:12px;color:#888;margin-top:10px;word-break:break-all}
.p2pod-result-note{color:#999;font-size:12.5px;margin-top:14px;line-height:1.6}
.p2pod-done-btn{width:100%;border:0;border-radius:10px;padding:13px;margin-top:18px;background:#1a1a1a;color:#eee;font-weight:700;cursor:pointer}
`;

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";

  return v.toLocaleString(undefined, {
    maximumFractionDigits: d,
  });
}

function initials(name: string): string {
  return (name || "").trim().slice(0, 2).toUpperCase() || "P2";
}

export default function P2POrderDetail({
  orderId,
  onBack,
  onTradeCreated,
}: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [order, setOrder] = useState<P2POrder | null>(null);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  const [reputation, setReputation] =
    useState<MerchantReputation | null>(null);

  const [ownMethods, setOwnMethods] =
    useState<P2PPaymentMethod[] | null>(null);

  const [selectedMethodId, setSelectedMethodId] =
    useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [panelError, setPanelError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [result, setResult] = useState<{ tradeId: string } | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotFound(false);

    const { data, error: err } = await supabase
      .from("p2p_orders")
      .select(
        "id,user_id,merchant_name,side,asset,fiat_currency,price,min_limit,max_limit,available_usdt,payment_methods,completion_rate,avg_release_time_minutes,is_active,status,created_at"
      )
      .eq("id", orderId)
      .maybeSingle();

    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    if (!data) {
      setNotFound(true);
      return;
    }

    setOrder(data as P2POrder);
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    const ch = supabase
      .channel(`p2p-order-detail-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "p2p_orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          setStale(true);
          void loadOrder();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [orderId, loadOrder]);

  useEffect(() => {
    if (!order?.user_id) return;

    void supabase
      .rpc("get_merchant_reputation", {
        p_merchant_user_id: order.user_id,
      })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;

        if (row) {
          setReputation(row as MerchantReputation);
        }
      });
  }, [order?.user_id]);

  useEffect(() => {
    if (!order || order.side !== "buy") return;

    let cancelled = false;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) return;

      const { data } = await supabase
        .from("p2p_payment_methods")
        .select("id,bank_name,account_name,is_active")
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (!cancelled) {
        setOwnMethods((data || []) as P2PPaymentMethod[]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [order]);

  const isOwnOrder =
    !!order &&
    !!userId &&
    order.user_id === userId;

  const myTurnToBuy =
    order ? order.side === "sell" : true;

  const submitTrade = async () => {
    if (!order) return;

    setPanelError("");

    const amt = Number(amount);

    if (!Number.isFinite(amt) || amt <= 0) {
      setPanelError("Enter a valid amount.");
      return;
    }

    if (amt < order.min_limit || amt > order.max_limit) {
      setPanelError(
        `Amount must be between ${fmt(
          order.min_limit,
          8
        )} and ${fmt(order.max_limit, 8)} ${order.asset}.`
      );
      return;
    }

    if (amt > order.available_usdt) {
      setPanelError(
        "This order doesn't have enough liquidity remaining. Try a smaller amount."
      );
      return;
    }

    if (order.side === "buy" && !selectedMethodId) {
      setPanelError(
        "Select a payment method to receive payment into."
      );
      return;
    }

    setSubmitting(true);

    const { data, error: err } = await supabase.rpc(
      "create_p2p_trade_with_escrow",
      {
        p_order_id: order.id,
        p_crypto_amount: amt,
        p_payment_method_id:
          order.side === "buy"
            ? selectedMethodId
            : null,
      }
    );

    setSubmitting(false);

    if (err) {
      setPanelError(
        p2pTradeErrorMessage(err.message, order.side)
      );
      return;
    }

    const tradeId = String(data);

    setResult({ tradeId });

    onTradeCreated?.(tradeId);

    void loadOrder();
  };

  return (
    <div className="p2pod-page">
      <style>{css}</style>

      <div className="p2pod-shell">
        <header className="p2pod-top">
          <button
            className="p2pod-back"
            onClick={
              onBack ||
              (() => window.history.back())
            }
            aria-label="Back"
          >
            ←
          </button>

          <div className="p2pod-title">
            Order details
          </div>

          <div className="p2pod-spacer" />

          {order && (
            <span
              className={`p2pod-badge ${
                order.side === "sell"
                  ? "buy"
                  : "sell"
              }`}
            >
              {order.side === "sell"
                ? "Buy offer"
                : "Sell offer"}
            </span>
          )}
        </header>

        {loading && (
          <div className="p2pod-loading">
            Loading order…
          </div>
        )}

        {!loading && error && (
          <div className="p2pod-error">
            {error}
          </div>
        )}

        {!loading &&
          !error &&
          notFound && (
            <div className="p2pod-notfound">
              This order isn't available. It may have
              been completed, paused, or removed by the
              merchant.
            </div>
          )}

        {!loading &&
          !error &&
          order && (
            <>
              <div className="p2pod-header-card">
                <div className="p2pod-merchant-row">
                  <div className="p2pod-avatar">
                    {initials(order.merchant_name)}
                  </div>

                  <div>
                    <div className="p2pod-merchant-name">
                      {order.merchant_name}
                    </div>

                    <div className="p2pod-merchant-rep">
                      {fmt(
                        order.completion_rate,
                        1
                      )}
                      % completion
                      {order.avg_release_time_minutes !=
                      null
                        ? ` · ~${order.avg_release_time_minutes}m release`
                        : ""}
                      {reputation &&
                      reputation.review_count > 0
                        ? ` · ${fmt(
                            reputation.avg_rating,
                            1
                          )}★ (${
                            reputation.review_count
                          })`
                        : ""}
                    </div>
                  </div>

                  <div className="p2pod-price-block">
                    <div className="p2pod-price">
                      {fmt(order.price, 4)}
                    </div>

                    <div className="p2pod-price-unit">
                      {order.fiat_currency} /{" "}
                      {order.asset}
                    </div>
                  </div>
                </div>

                {stale && (
                  <div className="p2pod-stale">
                    This order just updated live —
                    terms below reflect the latest
                    values.
                  </div>
                )}
              </div>

              <div className="p2pod-section">
                <h3>Order terms</h3>

                <div className="p2pod-detail-row">
                  <span>Limits</span>

                  <span>
                    {fmt(order.min_limit, 8)} –{" "}
                    {fmt(order.max_limit, 8)}{" "}
                    {order.asset}
                  </span>
                </div>

                <div className="p2pod-detail-row">
                  <span>Available</span>

                  <span>
                    {fmt(
                      order.available_usdt,
                      8
                    )}{" "}
                    {order.asset}
                  </span>
                </div>

                <div className="p2pod-detail-row">
                  <span>Status</span>

                  <span>
                    {order.is_active &&
                    order.status === "active"
                      ? "Active"
                      : "Paused"}
                  </span>
                </div>

                {!!order.payment_methods
                  ?.length && (
                  <div className="p2pod-detail-row">
                    <span>
                      Payment methods
                    </span>

                    <span className="p2pod-methods">
                      {order.payment_methods.map(
                        (m) => (
                          <span
                            key={m}
                            className="p2pod-chip"
                          >
                            {m}
                          </span>
                        )
                      )}
                    </span>
                  </div>
                )}
              </div>

              {isOwnOrder ? (
                <div className="p2pod-own-note">
                  This is your own order — you
                  can't trade against it.
                </div>
              ) : result ? (
                <div className="p2pod-section">
                  <div className="p2pod-result">
                    <div className="p2pod-result-icon">
                      ✓
                    </div>

                    <div>
                      Your trade was created and
                      escrow has been locked.
                    </div>

                    <div className="p2pod-result-id">
                      Trade ID: {result.tradeId}
                    </div>

                    <div className="p2pod-result-note">
                      Payment and chat screens for
                      this trade are coming next —
                      it's live in the database and
                      will show up there once built.
                    </div>

                    <button
                      className="p2pod-done-btn"
                      onClick={() =>
                        setResult(null)
                      }
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : !(
                  order.is_active &&
                  order.status === "active"
                ) ? (
                <div className="p2pod-own-note">
                  This order is currently paused by
                  the merchant and can't be traded
                  against.
                </div>
              ) : (
                <div className="p2pod-section">
                  <h3>
                    {myTurnToBuy
                      ? "Buy"
                      : "Sell"}{" "}
                    {order.asset}
                  </h3>

                  <div className="p2pod-label">
                    <span>Amount</span>
                    <span>{order.asset}</span>
                  </div>

                  <div className="p2pod-input-wrap">
                    <input
                      className="p2pod-input"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) =>
                        setAmount(e.target.value)
                      }
                      placeholder={`${fmt(
                        order.min_limit,
                        4
                      )} – ${fmt(
                        order.max_limit,
                        4
                      )}`}
                    />
                  </div>

                  <div className="p2pod-hint">
                    ≈{" "}
                    {amount &&
                    Number.isFinite(
                      Number(amount)
                    )
                      ? fmt(
                          Number(amount) *
                            order.price,
                          2
                        )
                      : "—"}{" "}
                    {order.fiat_currency}
                  </div>

                  {order.side === "buy" && (
                    <>
                      <div
                        className="p2pod-label"
                        style={{ marginTop: 16 }}
                      >
                        <span>
                          Receive payment into
                        </span>
                        <span />
                      </div>

                      {ownMethods === null ? (
                        <div className="p2pod-hint">
                          Loading your payment
                          methods…
                        </div>
                      ) : ownMethods.length ===
                        0 ? (
                        <div className="p2pod-no-methods">
                          You don't have an active
                          payment method on file yet.
                          Adding one is coming in a
                          later update — you can't
                          fulfil a buy order until
                          then.
                        </div>
                      ) : (
                        <div className="p2pod-methods-pick">
                          {ownMethods.map((m) => (
                            <button
                              key={m.id}
                              className={`p2pod-method-btn ${
                                selectedMethodId ===
                                m.id
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() =>
                                setSelectedMethodId(
                                  m.id
                                )
                              }
                            >
                              {m.bank_name ||
                                "Payment method"}{" "}
                              —{" "}
                              {m.account_name ||
                                ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {panelError && (
                    <div className="p2pod-panel-error">
                      {panelError}
                    </div>
                  )}

                  <button
                    className={`p2pod-submit ${
                      myTurnToBuy
                        ? "buy"
                        : "sell"
                    }`}
                    disabled={
                      submitting ||
                      (order.side === "buy" &&
                        !ownMethods?.length)
                    }
                    onClick={() =>
                      void submitTrade()
                    }
                  >
                    {submitting
                      ? "Creating trade…"
                      : `${
                          myTurnToBuy
                            ? "Buy"
                            : "Sell"
                        } ${order.asset}`}
                  </button>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
    }
