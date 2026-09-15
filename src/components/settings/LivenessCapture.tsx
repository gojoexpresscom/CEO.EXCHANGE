import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { supabase } from "../../lib/supabase";
import { GOLD, GOLD_LIGHT, BORDER } from "./settingsStyles";

type Props = {
  userId: string;
  onComplete: (urls: string[], evidence: LivenessEvidence) => void;
  onCancel: () => void;
  notify: (msg: string) => void;
};

export type LivenessStepEvidence = {
  stage: string;
  yaw: number;
  pitch: number;
  baseline_yaw: number;
  baseline_pitch: number;
  delta_yaw: number;
  delta_pitch: number;
  confirmed_at: string;
  path: string;
};

export type LivenessEvidence = {
  version: 1;
  method: "mediapipe_face_landmarker_pose";
  steps: LivenessStepEvidence[];
  completed_at: string;
};

type StageId = "forward" | "right" | "left" | "up" | "down";

type Stage = {
  id: StageId;
  title: string;
  short: string;
  instruction: string;
  failHint: string;
  arrow: string;
};

/** Sequence required by product: Straight → Right → Left → Up → Down */
const STAGES: Stage[] = [
  {
    id: "forward",
    title: "Look Straight",
    short: "Straight",
    instruction: "Look straight at the camera",
    failHint: "Center your face and look straight ahead",
    arrow: "●",
  },
  {
    id: "right",
    title: "Turn Right",
    short: "Right",
    instruction: "Turn your head right",
    failHint: "Please turn your head right →",
    arrow: "→",
  },
  {
    id: "left",
    title: "Turn Left",
    short: "Left",
    instruction: "Turn your head left",
    failHint: "Please turn your head left ←",
    arrow: "←",
  },
  {
    id: "up",
    title: "Look Up",
    short: "Up",
    instruction: "Look up",
    failHint: "Please look up ↑",
    arrow: "↑",
  },
  {
    id: "down",
    title: "Look Down",
    short: "Down",
    instruction: "Look down",
    failHint: "Please look down ↓",
    arrow: "↓",
  },
];

// Tuned for front-camera phone distance; slightly forgiving for real users
const YAW_THRESHOLD = 0.18;
const PITCH_THRESHOLD = 0.14;
const NEUTRAL_YAW_MAX = 0.14;
const NEUTRAL_PITCH_MAX = 0.14;
const STABILITY_SAMPLES = 3;
const COOLDOWN_MS = 700;
const SAMPLE_MS = 70;
const MIN_FACE_SCORE = 0.45;

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

type PoseSample = { yaw: number; pitch: number };

/**
 * Head-pose from Face Landmarker mesh.
 * Video is mirrored (scaleX -1). We flip yaw so positive = user's left.
 */
function estimatePose(landmarks: { x: number; y: number; z?: number }[]): PoseSample | null {
  if (!landmarks || landmarks.length < 300) return null;
  const nose = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  if (!nose || !leftCheek || !rightCheek || !leftEye || !rightEye || !chin || !forehead) return null;

  const midX = (leftCheek.x + rightCheek.x) / 2;
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 0.001;
  const rawYaw = (nose.x - midX) / faceWidth;
  // Mirror-aware: positive yaw = user turned left
  const yaw = -rawYaw;

  const eyeY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.abs(chin.y - forehead.y) || 0.001;
  // Positive pitch = looking up
  const pitch = (eyeY - nose.y) / faceHeight;

  return { yaw, pitch };
}

function stageSatisfied(stageId: StageId, baseline: PoseSample, current: PoseSample): boolean {
  const dy = current.yaw - baseline.yaw;
  const dp = current.pitch - baseline.pitch;
  switch (stageId) {
    case "forward":
      return Math.abs(current.yaw) < NEUTRAL_YAW_MAX && Math.abs(current.pitch) < NEUTRAL_PITCH_MAX;
    case "left":
      return dy >= YAW_THRESHOLD;
    case "right":
      return dy <= -YAW_THRESHOLD;
    case "up":
      return dp >= PITCH_THRESHOLD;
    case "down":
      return dp <= -PITCH_THRESHOLD;
    default:
      return false;
  }
}

type Phase = "intro" | "tracking" | "done";

export default function LivenessCapture({ userId, onComplete, onCancel, notify }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const baselineRef = useRef<PoseSample | null>(null);
  const stableCountRef = useRef(0);
  const lastSampleRef = useRef(0);
  const capturingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const stageIdxRef = useRef(0);
  const pathsRef = useRef<string[]>([]);
  const evidenceRef = useRef<LivenessStepEvidence[]>([]);
  const aliveRef = useRef(true);

  const [phase, setPhase] = useState<Phase>("intro");
  const [stageIdx, setStageIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [permError, setPermError] = useState("");
  const [status, setStatus] = useState("Position your face inside the frame");
  const [statusKind, setStatusKind] = useState<"neutral" | "warn" | "ok" | "capture">("neutral");
  const [capturing, setCapturing] = useState(false);
  const [modelState, setModelState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [faceFound, setFaceFound] = useState(false);
  const [flash, setFlash] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Load Face Landmarker
  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!cancelled && !landmarkerRef.current) setModelState("unavailable");
    }, 18000);

    async function init() {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        let lm: FaceLandmarker;
        try {
          lm = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          });
        } catch {
          lm = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: LANDMARKER_MODEL, delegate: "CPU" },
            runningMode: "VIDEO",
            numFaces: 1,
          });
        }
        if (cancelled) {
          lm.close();
          return;
        }
        landmarkerRef.current = lm;
        setModelState("ready");
      } catch {
        if (!cancelled) setModelState("unavailable");
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void init();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  // Camera
  useEffect(() => {
    let cancelled = false;
    async function attachStream(stream: MediaStream) {
      const video = videoRef.current;
      if (!video) return false;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");
      video.muted = true;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        await new Promise((r) => setTimeout(r, 60));
        await video.play().catch(() => undefined);
      }
      return true;
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermError(
          "This browser does not support camera access. Please use Chrome or Safari over HTTPS."
        );
        return;
      }
      const attempts: MediaStreamConstraints[] = [
        {
          audio: false,
          video: { facingMode: { ideal: "user" }, width: { ideal: 720 }, height: { ideal: 960 } },
        },
        { audio: false, video: { facingMode: "user" } },
        { audio: false, video: true },
      ];
      let lastErr: unknown = null;
      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            stream.getTracks().forEach((tr) => tr.stop());
            return;
          }
          streamRef.current = stream;
          let attached = await attachStream(stream);
          if (!attached) {
            for (let i = 0; i < 12 && !cancelled && !attached; i++) {
              await new Promise((r) => setTimeout(r, 80));
              attached = await attachStream(stream);
            }
          }
          if (cancelled) return;
          if (!attached) {
            setPermError("Camera started but preview could not attach. Close and try again.");
            return;
          }
          setReady(true);
          return;
        } catch (e) {
          lastErr = e;
        }
      }
      const name = (lastErr as { name?: string } | null)?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setPermError(
          "Camera access is required for identity verification. Please allow camera access in your browser settings and try again."
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setPermError("Camera unavailable. Please check your camera and try again.");
      } else {
        setPermError(
          "Could not open the camera. Use HTTPS, allow permissions, and try again on Chrome or Safari."
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      aliveRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  const captureFrame = useCallback(async (stageId: string): Promise<string> => {
    const video = videoRef.current;
    if (!video) throw new Error("Camera not ready");
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 640;
    c.height = video.videoHeight || 480;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    // Un-mirror for storage (video is CSS mirrored)
    ctx.translate(c.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, c.width, c.height);

    const blob: Blob = await new Promise((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Frame encode failed"))), "image/jpeg", 0.9);
    });

    const path = `${userId}/liveness/${stageId}_${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("account-verification-documents")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    return path;
  }, [userId]);

  // Tracking loop — only while phase === tracking
  useEffect(() => {
    if (phase !== "tracking" || !ready || modelState !== "ready" || permError) return;

    aliveRef.current = true;
    stageIdxRef.current = stageIdx;
    setStatus(STAGES[stageIdx].instruction);
    setStatusKind("neutral");

    const tick = () => {
      if (!aliveRef.current) return;
      const video = videoRef.current;
      const lm = landmarkerRef.current;
      const now = performance.now();

      if (
        video &&
        lm &&
        video.readyState >= 2 &&
        now - lastSampleRef.current >= SAMPLE_MS &&
        !capturingRef.current &&
        now >= cooldownUntilRef.current
      ) {
        lastSampleRef.current = now;
        try {
          const result = lm.detectForVideo(video, now);
          const face = result?.faceLandmarks?.[0];
          const score =
            (result as any)?.faceBlendshapes?.[0]?.categories?.[0]?.score ??
            (face ? 1 : 0);

          if (!face || (typeof score === "number" && score < MIN_FACE_SCORE && score !== 0)) {
            setFaceFound(false);
            stableCountRef.current = 0;
            setStatus("Position your face inside the frame");
            setStatusKind("warn");
          } else {
            setFaceFound(true);
            const pose = estimatePose(face);
            if (!pose) {
              setStatus("Center your face");
              setStatusKind("warn");
            } else {
              const stage = STAGES[stageIdxRef.current];

              // Establish baseline on forward stage
              if (!baselineRef.current) {
                if (
                  Math.abs(pose.yaw) < NEUTRAL_YAW_MAX &&
                  Math.abs(pose.pitch) < NEUTRAL_PITCH_MAX
                ) {
                  stableCountRef.current += 1;
                  setStatus("Perfect — hold still");
                  setStatusKind("ok");
                  if (stableCountRef.current >= STABILITY_SAMPLES) {
                    baselineRef.current = { yaw: pose.yaw, pitch: pose.pitch };
                    // If current stage is forward, capture it immediately after baseline
                    if (stage.id === "forward") {
                      stableCountRef.current = STABILITY_SAMPLES;
                    } else {
                      stableCountRef.current = 0;
                      setStatus(stage.instruction);
                      setStatusKind("neutral");
                    }
                  }
                } else {
                  stableCountRef.current = 0;
                  setStatus("Center your face and look straight");
                  setStatusKind("warn");
                }
              }

              const baseline = baselineRef.current;
              if (baseline) {
                const ok = stageSatisfied(stage.id, baseline, pose);
                if (ok) {
                  stableCountRef.current += 1;
                  setStatus(
                    stage.id === "forward" ? "Perfect — hold still" : "Movement detected — hold…"
                  );
                  setStatusKind("ok");
                  if (stableCountRef.current >= STABILITY_SAMPLES) {
                    capturingRef.current = true;
                    setCapturing(true);
                    setFlash(true);
                    setStatus("Captured ✓");
                    setStatusKind("capture");
                    void (async () => {
                      try {
                        const path = await captureFrame(stage.id);
                        const stepEv: LivenessStepEvidence = {
                          stage: stage.id,
                          yaw: pose.yaw,
                          pitch: pose.pitch,
                          baseline_yaw: baseline.yaw,
                          baseline_pitch: baseline.pitch,
                          delta_yaw: pose.yaw - baseline.yaw,
                          delta_pitch: pose.pitch - baseline.pitch,
                          confirmed_at: new Date().toISOString(),
                          path,
                        };
                        evidenceRef.current = [...evidenceRef.current, stepEv];
                        pathsRef.current = [...pathsRef.current, path];
                        stableCountRef.current = 0;
                        cooldownUntilRef.current = performance.now() + COOLDOWN_MS;

                        if (pathsRef.current.length >= STAGES.length) {
                          setPhase("done");
                          setStatus("Face verification complete");
                          setStatusKind("capture");
                          stopCamera();
                          const evidence: LivenessEvidence = {
                            version: 1,
                            method: "mediapipe_face_landmarker_pose",
                            steps: evidenceRef.current,
                            completed_at: new Date().toISOString(),
                          };
                          // Brief pause so user sees success
                          window.setTimeout(() => {
                            onComplete(pathsRef.current, evidence);
                          }, 650);
                        } else {
                          const next = pathsRef.current.length;
                          stageIdxRef.current = next;
                          setStageIdx(next);
                          setStatus(STAGES[next].instruction);
                          setStatusKind("neutral");
                          notify(`Step ${next + 1}/${STAGES.length}`);
                        }
                      } catch (e: any) {
                        setStatus(e?.message || "Capture failed — try again");
                        setStatusKind("warn");
                        stableCountRef.current = 0;
                      } finally {
                        capturingRef.current = false;
                        setCapturing(false);
                        window.setTimeout(() => setFlash(false), 350);
                      }
                    })();
                  }
                } else {
                  stableCountRef.current = 0;
                  setStatus(stage.failHint);
                  setStatusKind("warn");
                }
              }
            }
          }
        } catch {
          // ignore transient detect errors
        }
      }

      if (aliveRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      aliveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [phase, ready, modelState, permError, stageIdx, captureFrame, stopCamera, onComplete, notify]);

  const startTracking = () => {
    if (!ready) {
      notify("Camera is still starting…");
      return;
    }
    if (modelState === "loading") {
      notify("Face tracking model is still loading…");
      return;
    }
    if (modelState === "unavailable") {
      notify("Face tracking model unavailable. Check network and retry.");
      return;
    }
    // Reset state for a clean run
    baselineRef.current = null;
    stableCountRef.current = 0;
    stageIdxRef.current = 0;
    pathsRef.current = [];
    evidenceRef.current = [];
    capturingRef.current = false;
    cooldownUntilRef.current = 0;
    setStageIdx(0);
    setPhase("tracking");
    setStatus(STAGES[0].instruction);
    setStatusKind("neutral");
  };

  const stage = STAGES[stageIdx];
  const ringColor =
    statusKind === "capture"
      ? "#39d98a"
      : statusKind === "ok"
        ? GOLD
        : statusKind === "warn"
          ? "#c9a227"
          : GOLD;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100%",
        background: "#050505",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "8px 16px 20px",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes liveRingPulse {
          0% { box-shadow: 0 0 0 0 rgba(245,181,27,0.35); }
          70% { box-shadow: 0 0 0 14px rgba(245,181,27,0); }
          100% { box-shadow: 0 0 0 0 rgba(245,181,27,0); }
        }
        @keyframes liveScan {
          0% { top: 8%; opacity: 0; }
          15% { opacity: 0.85; }
          85% { opacity: 0.85; }
          100% { top: 88%; opacity: 0; }
        }
        @keyframes liveFlash {
          0% { opacity: 0.55; }
          100% { opacity: 0; }
        }
        @keyframes liveFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Ambient gold glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(245,181,27,0.08) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          position: "relative",
          zIndex: 1,
        }}
      >
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          aria-label="Back"
          style={{
            width: 40,
            height: 40,
            border: 0,
            borderRadius: 12,
            background: "transparent",
            color: "#f0f0f0",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ‹
        </button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 16 }}>
          Identity Verification
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Mini progress: Documents ✓ · Liveness · Review · Complete */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 0,
          marginBottom: 18,
          position: "relative",
          zIndex: 1,
        }}
      >
        {["Documents", "Liveness", "Review", "Complete"].map((label, i) => {
          const doneStep = i === 0 || (i === 1 && phase === "done");
          const active = i === 1 && phase !== "done";
          return (
            <React.Fragment key={label}>
              {i > 0 && (
                <div
                  style={{
                    width: 28,
                    height: 2,
                    background: doneStep || active ? GOLD : "#333",
                  }}
                />
              )}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    background: doneStep
                      ? `linear-gradient(135deg,${GOLD},#d98e00)`
                      : active
                        ? "#1a1508"
                        : "#111",
                    border: `1.5px solid ${doneStep || active ? GOLD : "#333"}`,
                    color: doneStep ? "#090909" : active ? GOLD : "#666",
                    boxShadow: active ? `0 0 12px rgba(245,181,27,0.35)` : undefined,
                  }}
                >
                  {doneStep ? "✓" : i + 1}
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: doneStep || active ? GOLD_LIGHT : "#555",
                  }}
                >
                  {label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div style={{ textAlign: "center", position: "relative", zIndex: 1, marginBottom: 6 }}>
        <div
          style={{
            color: GOLD,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          {phase === "done"
            ? "COMPLETE"
            : phase === "tracking"
              ? `STEP ${stageIdx + 1} OF ${STAGES.length}`
              : "FACE VERIFICATION"}
        </div>
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: -0.3,
            lineHeight: 1.2,
          }}
        >
          Face Movement <span style={{ color: GOLD }}>Capture</span>
        </h2>
        <p style={{ margin: 0, color: "#888", fontSize: 13, lineHeight: 1.45, padding: "0 8px" }}>
          We need to verify that you&apos;re a real person. Please follow the camera movement
          instructions below.
        </p>
      </div>

      {/* Camera ring */}
      <div
        style={{
          position: "relative",
          width: "min(280px, 78vw)",
          aspectRatio: "1",
          margin: "18px auto 14px",
          zIndex: 1,
        }}
      >
        {/* Outer glow ring */}
        <div
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            border: `2px solid ${ringColor}`,
            opacity: 0.9,
            animation:
              phase === "tracking" && faceFound && !capturing
                ? "liveRingPulse 1.8s ease-out infinite"
                : undefined,
            transition: "border-color 0.25s ease",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#0a0a0a",
            border: `3px solid ${ringColor}`,
            boxShadow: `0 0 40px rgba(245,181,27,0.18)`,
            transition: "border-color 0.25s ease",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
              background: "#000",
            }}
          />
          {/* Corner brackets */}
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
          >
            <path
              d="M22 32 V22 H32"
              fill="none"
              stroke={ringColor}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M78 32 V22 H68"
              fill="none"
              stroke={ringColor}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M22 68 V78 H32"
              fill="none"
              stroke={ringColor}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M78 68 V78 H68"
              fill="none"
              stroke={ringColor}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
          {phase === "tracking" && (
            <div
              style={{
                position: "absolute",
                left: "12%",
                right: "12%",
                height: 2,
                background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
                animation: "liveScan 2.4s linear infinite",
                pointerEvents: "none",
              }}
            />
          )}
          {flash && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "#fff",
                animation: "liveFlash 0.35s ease-out forwards",
                pointerEvents: "none",
              }}
            />
          )}
        </div>

        {/* AI badge */}
        <div
          style={{
            position: "absolute",
            right: -8,
            top: 18,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 12,
            background: "rgba(12,12,12,0.92)",
            border: `1px solid ${BORDER}`,
            fontSize: 10,
            fontWeight: 700,
            color: GOLD_LIGHT,
            letterSpacing: 0.3,
          }}
        >
          <span style={{ fontSize: 12 }}>◈</span>
          <span>
            AI POWERED
            <br />
            <span style={{ color: "#888", fontWeight: 600, fontSize: 9 }}>Face Tracking</span>
          </span>
        </div>
      </div>

      {/* Movement indicators */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          marginBottom: 14,
          position: "relative",
          zIndex: 1,
          flexWrap: "wrap",
        }}
      >
        {STAGES.map((st, i) => {
          const completed = i < stageIdx || phase === "done";
          const current = i === stageIdx && phase === "tracking";
          return (
            <div
              key={st.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                minWidth: 52,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: completed ? 16 : 18,
                  fontWeight: 800,
                  background: completed
                    ? "linear-gradient(135deg,rgba(245,181,27,0.25),rgba(245,181,27,0.08))"
                    : current
                      ? "#161208"
                      : "#0c0c0c",
                  border: `1.5px solid ${completed || current ? GOLD : "#2a2a2a"}`,
                  color: completed || current ? GOLD : "#555",
                  boxShadow: current ? `0 0 14px rgba(245,181,27,0.3)` : undefined,
                  transition: "all 0.25s ease",
                }}
              >
                {completed ? "✓" : st.arrow}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: completed || current ? "#ddd" : "#555",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                {st.short.split(" ").map((w, wi) => (
                  <span key={wi} style={{ display: "block" }}>
                    {w}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {/* Status / guidance */}
      <div
        style={{
          margin: "0 auto 16px",
          maxWidth: 360,
          width: "100%",
          borderRadius: 14,
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          background:
            statusKind === "capture"
              ? "rgba(57,217,138,0.1)"
              : statusKind === "warn"
                ? "rgba(245,181,27,0.08)"
                : "rgba(20,20,20,0.9)",
          border: `1px solid ${
            statusKind === "capture"
              ? "rgba(57,217,138,0.35)"
              : statusKind === "warn"
                ? BORDER
                : "#222"
          }`,
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 800,
            background: statusKind === "capture" ? "#39d98a" : GOLD,
            color: "#090909",
          }}
        >
          {statusKind === "capture" ? "✓" : "!"}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: statusKind === "capture" ? "#9dffc2" : "#e8d9a8",
            lineHeight: 1.35,
          }}
        >
          {permError
            ? permError
            : modelState === "unavailable"
              ? "Face tracking model could not load. Check your connection and try again."
              : phase === "intro"
                ? "Please follow the instructions. If you don't turn your head, we won't be able to verify your identity."
                : status}
        </span>
      </div>

      {/* Primary action */}
      <div style={{ marginTop: "auto", position: "relative", zIndex: 1 }}>
        {permError ? (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            style={primaryBtnStyle}
          >
            Close
          </button>
        ) : phase === "intro" ? (
          <button
            type="button"
            disabled={!ready || modelState === "loading"}
            onClick={startTracking}
            style={{
              ...primaryBtnStyle,
              opacity: !ready || modelState === "loading" ? 0.55 : 1,
              cursor: !ready || modelState === "loading" ? "not-allowed" : "pointer",
            }}
          >
            {!ready
              ? "Starting camera…"
              : modelState === "loading"
                ? "Loading tracker…"
                : modelState === "unavailable"
                  ? "Tracker unavailable"
                  : "Verify"}
          </button>
        ) : phase === "done" ? (
          <div
            style={{
              textAlign: "center",
              color: "#39d98a",
              fontWeight: 700,
              fontSize: 15,
              padding: 12,
            }}
          >
            Face verification complete
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onCancel();
            }}
            style={secondaryBtnStyle}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 52,
  border: 0,
  borderRadius: 999,
  background: `linear-gradient(135deg, ${GOLD} 0%, #d98e00 100%)`,
  color: "#090909",
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
  boxShadow: "0 8px 28px rgba(245,181,27,0.28)",
  letterSpacing: 0.2,
};

const secondaryBtnStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  border: `1px solid ${BORDER}`,
  borderRadius: 999,
  background: "transparent",
  color: GOLD_LIGHT,
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};
