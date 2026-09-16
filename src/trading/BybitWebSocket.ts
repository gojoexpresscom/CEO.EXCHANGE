export type BybitMarketMessage = {
  topic?: string;
  type?: string;
  ts?: number;
  data?: unknown;
  success?: boolean;
  ret_msg?: string;
  op?: string;
};

type MessageHandler = (message: BybitMarketMessage) => void;
type StatusHandler = (status: "connecting" | "connected" | "disconnected") => void;

const BYBIT_SPOT_WS = "wss://stream.bybit.com/v5/public/spot";

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const HEARTBEAT_INTERVAL = 20000;

export class BybitWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  private reconnectAttempt = 0;
  private stopped = false;

  private topics = new Set<string>();

  private readonly onMessage: MessageHandler;
  private readonly onStatus?: StatusHandler;

  constructor(
    onMessage: MessageHandler,
    onStatus?: StatusHandler,
  ) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  connect(topics: string[]) {
    this.stopped = false;

    this.topics = new Set(
      topics.filter((topic) => typeof topic === "string" && topic.length > 0),
    );

    this.clearReconnectTimer();
    this.clearHeartbeat();

    this.reconnectAttempt = 0;

    this.open();
  }

  updateTopics(topics: string[]) {
    const nextTopics = new Set(
      topics.filter((topic) => typeof topic === "string" && topic.length > 0),
    );

    const previousTopics = Array.from(this.topics);

    this.topics = nextTopics;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const removed = previousTopics.filter((topic) => !nextTopics.has(topic));
    const added = Array.from(nextTopics).filter(
      (topic) => !previousTopics.includes(topic),
    );

    if (removed.length > 0) {
      this.send({
        op: "unsubscribe",
        args: removed,
      });
    }

    if (added.length > 0) {
      this.send({
        op: "subscribe",
        args: added,
      });
    }
  }

  disconnect() {
    this.stopped = true;

    this.clearReconnectTimer();
    this.clearHeartbeat();

    this.topics.clear();

    const socket = this.ws;
    this.ws = null;

    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;

      try {
        socket.close();
      } catch {
        // Ignore close errors during cleanup.
      }
    }

    this.onStatus?.("disconnected");
  }

  private open() {
    if (this.stopped) return;

    this.onStatus?.("connecting");

    let socket: WebSocket;

    try {
      socket = new WebSocket(BYBIT_SPOT_WS);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws = socket;

    socket.onopen = () => {
      if (this.stopped || this.ws !== socket) return;

      this.reconnectAttempt = 0;

      this.onStatus?.("connected");

      this.startHeartbeat();

      const topics = Array.from(this.topics);

      if (topics.length > 0) {
        this.send({
          op: "subscribe",
          args: topics,
        });
      }
    };

    socket.onmessage = (event) => {
      if (this.stopped || this.ws !== socket) return;

      let parsed: BybitMarketMessage;

      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }

      if (!parsed || typeof parsed !== "object") {
        return;
      }

      // Bybit heartbeat response.
      if (parsed.op === "pong") {
        return;
      }

      // Subscription acknowledgements are not market data.
      if (parsed.op === "subscribe" || parsed.op === "unsubscribe") {
        return;
      }

      this.onMessage(parsed);
    };

    socket.onerror = () => {
      if (this.ws !== socket) return;

      // onclose will perform reconnect.
      try {
        socket.close();
      } catch {
        // Ignore.
      }
    };

    socket.onclose = () => {
      if (this.ws === socket) {
        this.ws = null;
      }

      this.clearHeartbeat();

      if (this.stopped) {
        this.onStatus?.("disconnected");
        return;
      }

      this.onStatus?.("disconnected");
      this.scheduleReconnect();
    };
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      // Socket may have closed between readyState check and send.
    }
  }

  private startHeartbeat() {
    this.clearHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.stopped) return;

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }

      this.send({
        op: "ping",
      });
    }, HEARTBEAT_INTERVAL);
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY *
        Math.pow(2, Math.min(this.reconnectAttempt, 5)),
      MAX_RECONNECT_DELAY,
    );

    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;

      if (!this.stopped) {
        this.open();
      }
    }, delay);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  }
