import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD } from "./settingsStyles";

type Props = {
  userId: string;
  onComplete: (urls: string[]) => void;
  onCancel: () => void;
  notify: (msg: string) => void;
};

const DIRECTIONS = ["Look forward", "Turn left", "Turn right", "Look up"] as const;

/**
 * 4-direction liveness capture.
 * Stores paths (not public URLs) into the private kyc-documents bucket.
 * Paths are later written into kyc_submissions.liveness_capture_urls (jsonb).
 */
export default function LivenessCapture({ userId, onComplete, onCancel, notify }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        setError("Camera permission is required for liveness capture.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current || busy) return;
    setBusy(true);
    setError("");
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, 0, 0);
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture failed"))), "image/jpeg", 0.85);
      });

      const path = `${userId}/liveness/${Date.now()}_${step}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("kyc-documents")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const next = [...paths, path];
      setPaths(next);
      if (next.length >= 4) {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onComplete(next);
      } else {
        setStep(next.length);
        notify(`Captured ${next.length}/4`);
      }
    } catch (e: any) {
      setError(e?.message || "Capture failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={s.section}>
      <div style={s.infoBox}>
        Follow the direction, then tap Capture. Four photos are stored privately for review.
      </div>
      <p style={{ color: GOLD, fontWeight: 700, textAlign: "center", margin: "8px 0 12px" }}>
        {DIRECTIONS[step]} ({step + 1}/4)
      </p>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 320,
          margin: "0 auto 12px",
          borderRadius: 16,
          overflow: "hidden",
          background: "#111",
          aspectRatio: "3/4",
        }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
        />
        {!ready && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#777" }}>
            Starting camera…
          </div>
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
      {error && <div style={s.errorBox}>{error}</div>}
      <button type="button" style={s.primaryBtn} disabled={!ready || busy} onClick={() => void capture()}>
        {busy ? "Saving…" : "Capture"}
      </button>
      <button type="button" style={s.secondaryBtn} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
