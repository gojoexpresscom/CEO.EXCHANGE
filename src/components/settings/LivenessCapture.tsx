import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT } from "./settingsStyles";

type Props = {
  userId: string;
  onComplete: (urls: string[]) => void;
  onCancel: () => void;
  notify: (msg: string) => void;
};

type Stage = {
  id: string;
  title: string;
  hint: string;
};

const STAGES: Stage[] = [
  { id: "forward", title: "Look at the camera", hint: "Center your face in the circle" },
  { id: "left", title: "Turn left slowly", hint: "Turn your head to the left" },
  { id: "right", title: "Turn right slowly", hint: "Turn your head to the right" },
  { id: "up", title: "Look up slowly", hint: "Tilt your chin upward" },
  { id: "down", title: "Look down slowly", hint: "Tilt your chin downward" },
];

const HOLD_MS = 3000;
const SAMPLE_MS = 200;

/**
 * Auto-capture liveness (5 poses). No manual Capture button.
 * Uses FaceDetector API when available; otherwise frame-stability heuristics.
 * Uploads private paths to kyc-documents bucket.
 */
export default function LivenessCapture({ userId, onComplete, onCancel, notify }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const holdStartRef = useRef<number | null>(null);
  const lastSampleRef = useRef<number>(0);
  const prevLumaRef = useRef<number | null>(null);

  const [stageIdx, setStageIdx] = useState(0);
  const [paths, setPaths] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [permError, setPermError] = useState("");
  const [status, setStatus] = useState("Allow camera access");
  const [holdProgress, setHoldProgress] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [done, setDone] = useState(false);
  const capturingRef = useRef(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
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
          setStatus("Position your face in the circle");
        }
      } catch {
        setPermError("Camera permission is required for identity verification.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [stopCamera]);

  const sampleCenter = useCallback((): { ok: boolean; luma: number; motion: number } => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return { ok: false, luma: 0, motion: 999 };
    const w = 64;
    const h = 64;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { ok: false, luma: 0, motion: 999 };
    // sample center oval region of mirrored face area
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const sx = vw * 0.25;
    const sy = vh * 0.2;
    const sw = vw * 0.5;
    const sh = vh * 0.55;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sum += y;
      count++;
    }
    const luma = sum / count;
    const prev = prevLumaRef.current;
    const motion = prev == null ? 0 : Math.abs(luma - prev);
    prevLumaRef.current = luma;
    // sufficient light + low motion = stable
    const ok = luma > 35 && luma < 230 && motion < 8;
    return { ok, luma, motion };
  }, []);

  const detectFace = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current;
    if (!video) return false;
    // Prefer native FaceDetector when present
    const FD = (window as any).FaceDetector;
    if (typeof FD === "function") {
      try {
        const detector = new FD({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await detector.detect(video);
        if (!faces?.length) return false;
        const f = faces[0].boundingBox;
        const vw = video.videoWidth || 1;
        const vh = video.videoHeight || 1;
        const cx = f.x + f.width / 2;
        const cy = f.y + f.height / 2;
        const centered = Math.abs(cx - vw / 2) < vw * 0.22 && Math.abs(cy - vh * 0.42) < vh * 0.2;
        const sized = f.width > vw * 0.18 && f.width < vw * 0.7;
        return centered && sized;
      } catch {
        /* fall through */
      }
    }
    const { ok } = sampleCenter();
    return ok;
  }, [sampleCenter]);

  const captureFrame = useCallback(async (): Promise<string> => {
    const video = videoRef.current;
    if (!video) throw new Error("Camera not ready");
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 640;
    c.height = video.videoHeight || 480;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(video, 0, 0);
    const blob: Blob = await new Promise((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture failed"))), "image/jpeg", 0.88);
    });
    const path = `${userId}/liveness/${Date.now()}_${STAGES[stageIdx].id}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("kyc-documents")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw upErr;
    return path;
  }, [userId, stageIdx]);

  // Detection loop
  useEffect(() => {
    if (!ready || done || capturingRef.current || permError) return;

    let alive = true;

    const tick = async () => {
      if (!alive || capturingRef.current) return;
      const now = performance.now();
      if (now - lastSampleRef.current < SAMPLE_MS) {
        rafRef.current = requestAnimationFrame(() => void tick());
        return;
      }
      lastSampleRef.current = now;

      const faceOk = await detectFace();
      if (!alive) return;

      if (faceOk) {
        if (holdStartRef.current == null) {
          holdStartRef.current = now;
          setStatus("Face detected — hold still…");
        }
        const elapsed = now - holdStartRef.current;
        const p = Math.min(1, elapsed / HOLD_MS);
        setHoldProgress(p);
        if (elapsed >= HOLD_MS) {
          capturingRef.current = true;
          setCapturing(true);
          setStatus("Captured ✓");
          try {
            const path = await captureFrame();
            const nextPaths = [...paths, path];
            setPaths(nextPaths);
            holdStartRef.current = null;
            setHoldProgress(0);
            prevLumaRef.current = null;
            if (nextPaths.length >= STAGES.length) {
              setDone(true);
              setStatus("Verification captures complete");
              stopCamera();
              onComplete(nextPaths);
            } else {
              setStageIdx(nextPaths.length);
              setStatus(STAGES[nextPaths.length].hint);
              notify(`Captured ${nextPaths.length}/${STAGES.length}`);
            }
          } catch (e: any) {
            setStatus(e?.message || "Capture failed — try again");
            holdStartRef.current = null;
            setHoldProgress(0);
          } finally {
            capturingRef.current = false;
            setCapturing(false);
          }
        }
      } else {
        holdStartRef.current = null;
        setHoldProgress(0);
        setStatus(STAGES[stageIdx].hint);
      }

      if (alive && !capturingRef.current && !done) {
        rafRef.current = requestAnimationFrame(() => void tick());
      }
    };

    rafRef.current = requestAnimationFrame(() => void tick());
    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, stageIdx, paths, done, permError, detectFace, captureFrame, onComplete, notify, stopCamera]);

  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];

  return (
    <div style={s.section}>
      <h3 style={{ margin: "0 0 6px", color: "#fff", fontSize: 17, textAlign: "center" }}>
        Verify your identity
      </h3>
      <p style={{ margin: "0 0 14px", color: "#888", fontSize: 13, textAlign: "center", lineHeight: 1.45 }}>
        Make sure your face is clearly visible. Move to a well-lit place. Remove anything covering your face.
      </p>

      {permError ? (
        <div style={s.errorBox}>{permError}</div>
      ) : (
        <>
          <p style={{ color: GOLD_LIGHT, fontWeight: 700, textAlign: "center", margin: "0 0 4px", fontSize: 15 }}>
            {stage.title}
          </p>
          <p style={{ color: "#666", textAlign: "center", margin: "0 0 12px", fontSize: 12 }}>
            Step {Math.min(stageIdx + 1, STAGES.length)} of {STAGES.length}
          </p>

          <div
            style={{
              position: "relative",
              width: "min(100%, 300px)",
              margin: "0 auto 14px",
              aspectRatio: "3 / 4",
              borderRadius: 20,
              overflow: "hidden",
              background: "#0a0a0a",
              border: `1.5px solid ${GOLD}`,
              boxShadow: `0 0 24px rgba(245,181,27,0.12)`,
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)",
              }}
            />
            {/* Oval face guide */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "42%",
                width: "68%",
                height: "48%",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: `2px solid ${holdProgress > 0 ? GOLD_LIGHT : "rgba(245,181,27,0.55)"}`,
                boxShadow: holdProgress > 0 ? `0 0 0 9999px rgba(0,0,0,0.45), 0 0 20px ${GOLD}` : "0 0 0 9999px rgba(0,0,0,0.4)",
                pointerEvents: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />
            {/* Hold progress ring base */}
            {holdProgress > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  bottom: 16,
                  transform: "translateX(-50%)",
                  width: "70%",
                  height: 4,
                  borderRadius: 99,
                  background: "#222",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${holdProgress * 100}%`,
                    height: "100%",
                    background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})`,
                    transition: "width 0.15s linear",
                  }}
                />
              </div>
            )}
            {!ready && (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#777", background: "#0a0a0a" }}>
                Starting camera…
              </div>
            )}
          </div>

          <p style={{ textAlign: "center", color: capturing ? "#39d98a" : "#ccc", fontSize: 13, minHeight: 20, margin: "0 0 8px" }}>
            {status}
          </p>
          {holdProgress > 0 && holdProgress < 1 && (
            <p style={{ textAlign: "center", color: GOLD, fontSize: 22, fontWeight: 800, margin: 0 }}>
              {Math.ceil((1 - holdProgress) * 3)}
            </p>
          )}
        </>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <button type="button" style={{ ...s.secondaryBtn, marginTop: 12 }} onClick={() => { stopCamera(); onCancel(); }}>
        Cancel
      </button>
    </div>
  );
}
