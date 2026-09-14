import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT } from "./settingsStyles";

type Props = {
  userId: string;
  onComplete: (urls: string[], evidence: LivenessEvidence) => void;
  onCancel: () => void;
  notify: (msg: string) => void;
};

/** Meaningful directional evidence sent with KYC submission (no new DB columns required). */
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

type StageId = "forward" | "left" | "right" | "up" | "down";

type Stage = {
  id: StageId;
  title: string;
  hint: string;
  failHint: string;
};

const STAGES: Stage[] = [
  {
    id: "forward",
    title: "Look at the camera",
    hint: "Center your face and look straight ahead",
    failHint: "Look straight at the camera with your face centered",
  },
  {
    id: "left",
    title: "Turn slowly to the left",
    hint: "Turn your head to the left",
    failHint: "Please turn your head to the left",
  },
  {
    id: "right",
    title: "Turn slowly to the right",
    hint: "Turn your head to the right",
    failHint: "Please turn your head to the right",
  },
  {
    id: "up",
    title: "Look up slowly",
    hint: "Tilt your chin upward",
    failHint: "Please tilt your head upward",
  },
  {
    id: "down",
    title: "Look down slowly",
    hint: "Tilt your chin downward",
    failHint: "Please tilt your head downward",
  },
];

/** Radians — tuned for phone front-camera distance; adjustable. */
const YAW_THRESHOLD = 0.22;
const PITCH_THRESHOLD = 0.16;
const NEUTRAL_YAW_MAX = 0.12;
const NEUTRAL_PITCH_MAX = 0.12;
const STABILITY_SAMPLES = 4;
const SAMPLE_MS = 80;
const MIN_FACE_SCORE = 0.5;

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * Head-pose from Face Landmarker 478-point mesh.
 * Yaw: horizontal offset of nose tip relative to cheek midpoints (mirrored preview aware).
 * Pitch: vertical position of nose vs eye / mouth landmarks.
 * Video is mirrored (scaleX -1); landmark x is already in image space — we flip for user-facing directions.
 */
function estimatePose(landmarks: { x: number; y: number; z?: number }[]): { yaw: number; pitch: number } | null {
  if (!landmarks || landmarks.length < 300) return null;

  // MediaPipe indices
  const nose = landmarks[1];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const chin = landmarks[152];
  const forehead = landmarks[10];

  if (!nose || !leftCheek || !rightCheek || !leftEye || !rightEye || !chin || !forehead) return null;

  const midX = (leftCheek.x + rightCheek.x) / 2;
  const faceWidth = Math.abs(rightCheek.x - leftCheek.x) || 0.01;
  // Image space: larger nose.x means nose is toward the right of the frame.
  // Mirrored preview: user turns their left → face appears to move right on screen.
  // We define yaw positive = user's head turned to their left (matches "Turn left").
  const rawYaw = (nose.x - midX) / faceWidth;
  const yaw = -rawYaw; // flip so positive = user left

  const eyeY = (leftEye.y + rightEye.y) / 2;
  const faceHeight = Math.abs(chin.y - forehead.y) || 0.01;
  // Positive pitch = chin up (user looking up)
  const pitch = (eyeY - nose.y) / faceHeight;

  return { yaw, pitch };
}

type PoseSample = { yaw: number; pitch: number };

function stageSatisfied(
  stageId: StageId,
  baseline: PoseSample,
  current: PoseSample
): boolean {
  const dy = current.yaw - baseline.yaw;
  const dp = current.pitch - baseline.pitch;

  switch (stageId) {
    case "forward":
      return (
        Math.abs(current.yaw) < NEUTRAL_YAW_MAX &&
        Math.abs(current.pitch) < NEUTRAL_PITCH_MAX
      );
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

/**
 * Directional liveness with MediaPipe Face Landmarker.
 * No countdown. No capture on face-presence alone.
 * Capture only after the required head movement is confirmed.
 */
export default function LivenessCapture({ userId, onComplete, onCancel, notify }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const baselineRef = useRef<PoseSample | null>(null);
  const stableCountRef = useRef(0);
  const lastSampleRef = useRef(0);
  const capturingRef = useRef(false);
  const stageIdxRef = useRef(0);
  const pathsRef = useRef<string[]>([]);
  const evidenceRef = useRef<LivenessStepEvidence[]>([]);

  const [stageIdx, setStageIdx] = useState(0);
  const [ready, setReady] = useState(false);
  const [permError, setPermError] = useState("");
  const [status, setStatus] = useState("Allow camera access");
  const [capturing, setCapturing] = useState(false);
  const [done, setDone] = useState(false);
  const [modelState, setModelState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [poseDebug, setPoseDebug] = useState({ yaw: 0, pitch: 0 });

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
    }, 15000);

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
      video.muted = true;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        await new Promise((r) => setTimeout(r, 50));
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
            for (let i = 0; i < 10 && !cancelled && !attached; i++) {
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
          setStatus(STAGES[0].hint);
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
        setPermError("No camera was found on this device.");
      } else {
        setPermError(
          "Could not open the camera. Use HTTPS, allow permissions, and try again on Chrome or Safari."
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
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
    ctx.drawImage(video, 0, 0);
    const blob: Blob = await new Promise((resolve, reject) => {
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Capture failed"))), "image/jpeg", 0.88);
    });
    const path = `${userId}/liveness/${Date.now()}_${stageId}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("kyc-documents")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw upErr;
    return path;
  }, [userId]);

  // Detection loop — directional state machine
  useEffect(() => {
    if (!ready || done || capturingRef.current || permError || modelState !== "ready") return;

    let alive = true;
    stageIdxRef.current = stageIdx;

    const tick = () => {
      if (!alive || capturingRef.current) return;
      const now = performance.now();
      if (now - lastSampleRef.current < SAMPLE_MS) {
        rafRef.current = requestAnimationFrame(() => void tick());
        return;
      }
      lastSampleRef.current = now;

      const video = videoRef.current;
      const lm = landmarkerRef.current;
      if (!video || !lm || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(() => void tick());
        return;
      }

      let pose: PoseSample | null = null;
      try {
        const result = lm.detectForVideo(video, now);
        const faces = result?.faceLandmarks ?? [];
        if (faces.length > 0) {
          pose = estimatePose(faces[0]);
        }
      } catch {
        pose = null;
      }

      const idx = stageIdxRef.current;
      const stage = STAGES[idx];

      if (!pose) {
        stableCountRef.current = 0;
        setStatus("Position your face in the frame");
        if (alive && !capturingRef.current) {
          rafRef.current = requestAnimationFrame(() => void tick());
        }
        return;
      }

      setPoseDebug({ yaw: pose.yaw, pitch: pose.pitch });

      // Establish neutral baseline on the first (forward) stage or when missing
      if (!baselineRef.current && stage.id === "forward") {
        if (
          Math.abs(pose.yaw) < NEUTRAL_YAW_MAX &&
          Math.abs(pose.pitch) < NEUTRAL_PITCH_MAX
        ) {
          stableCountRef.current += 1;
          setStatus("Hold still — calibrating…");
          if (stableCountRef.current >= STABILITY_SAMPLES) {
            baselineRef.current = { yaw: pose.yaw, pitch: pose.pitch };
            stableCountRef.current = 0;
            setStatus("Look straight — face confirmed");
          }
        } else {
          stableCountRef.current = 0;
          setStatus(stage.failHint);
        }
      }

      const baseline = baselineRef.current;
      if (!baseline) {
        if (stage.id !== "forward") {
          // Should not happen; re-calibrate
          setStatus("Look straight at the camera first");
        }
        if (alive && !capturingRef.current) {
          rafRef.current = requestAnimationFrame(() => void tick());
        }
        return;
      }

      const ok = stageSatisfied(stage.id, baseline, pose);

      if (ok) {
        stableCountRef.current += 1;
        setStatus(
          stage.id === "forward"
            ? "Face centered — hold still…"
            : "Movement detected — hold…"
        );
        if (stableCountRef.current >= STABILITY_SAMPLES) {
          capturingRef.current = true;
          setCapturing(true);
          setStatus("Captured ✓");
          void (async () => {
            try {
              const path = await captureFrame(stage.id);
              const stepEv: LivenessStepEvidence = {
                stage: stage.id,
                yaw: pose!.yaw,
                pitch: pose!.pitch,
                baseline_yaw: baseline.yaw,
                baseline_pitch: baseline.pitch,
                delta_yaw: pose!.yaw - baseline.yaw,
                delta_pitch: pose!.pitch - baseline.pitch,
                confirmed_at: new Date().toISOString(),
                path,
              };
              evidenceRef.current = [...evidenceRef.current, stepEv];
              pathsRef.current = [...pathsRef.current, path];
              stableCountRef.current = 0;

              if (pathsRef.current.length >= STAGES.length) {
                setDone(true);
                setStatus("Verification captures complete");
                stopCamera();
                const evidence: LivenessEvidence = {
                  version: 1,
                  method: "mediapipe_face_landmarker_pose",
                  steps: evidenceRef.current,
                  completed_at: new Date().toISOString(),
                };
                onComplete(pathsRef.current, evidence);
              } else {
                const next = pathsRef.current.length;
                stageIdxRef.current = next;
                setStageIdx(next);
                setStatus(STAGES[next].hint);
                notify(`Step ${next}/${STAGES.length} complete`);
              }
            } catch (e: any) {
              setStatus(e?.message || "Capture failed — try again");
              stableCountRef.current = 0;
            } finally {
              capturingRef.current = false;
              setCapturing(false);
            }
          })();
          return;
        }
      } else {
        stableCountRef.current = 0;
        setStatus(stage.failHint);
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
  }, [ready, stageIdx, done, permError, modelState, captureFrame, onComplete, notify, stopCamera]);

  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];

  return (
    <div style={{ ...s.section, background: "#000" }}>
      <style>{`
        @keyframes lcStageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes lcFrameGlow { 0% { box-shadow: 0 0 0 0 rgba(245,181,27,0.25); } 100% { box-shadow: 0 0 0 14px rgba(245,181,27,0); } }
      `}</style>
      <h3 style={{ margin: "0 0 6px", color: "#fff", fontSize: 17, textAlign: "center" }}>
        Verify your identity
      </h3>
      <p style={{ margin: "0 0 14px", color: "#888", fontSize: 13, textAlign: "center", lineHeight: 1.45 }}>
        Follow each instruction. The camera only captures after you complete the required head movement.
      </p>

      {permError ? (
        <div style={s.errorBox}>{permError}</div>
      ) : modelState === "unavailable" ? (
        <div style={s.errorBox}>
          Face pose model could not load. Check your connection and try again on a supported browser (Chrome / Safari).
        </div>
      ) : (
        <>
          <div key={stageIdx} style={{ animation: "lcStageIn 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>
            <p style={{ color: GOLD_LIGHT, fontWeight: 700, textAlign: "center", margin: "0 0 4px", fontSize: 15 }}>
              {stage.title}
            </p>
            <p style={{ color: "#666", textAlign: "center", margin: "0 0 12px", fontSize: 12 }}>
              Step {Math.min(stageIdx + 1, STAGES.length)} of {STAGES.length}
            </p>
          </div>

          <div
            style={{
              position: "relative",
              width: "min(100%, 300px)",
              margin: "0 auto 14px",
              aspectRatio: "3 / 4",
              borderRadius: 20,
              overflow: "hidden",
              background: "#000",
              border: `1.5px solid ${GOLD}`,
              boxShadow: capturing ? "0 0 30px rgba(57,217,138,0.25)" : "0 0 30px rgba(245,181,27,0.14)",
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
              }}
            />
            <svg
              viewBox="0 0 300 400"
              preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            >
              <defs>
                <mask id="kycFaceMask">
                  <rect width="300" height="400" fill="white" />
                  <path
                    d="M150 46 C100 46 70 96 70 160 C70 208 82 236 96 262 C108 284 122 306 136 322 C142 330 158 330 164 322 C178 306 192 284 204 262 C218 236 230 208 230 160 C230 96 200 46 150 46 Z"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect width="300" height="400" fill="rgba(0,0,0,0.55)" mask="url(#kycFaceMask)" />
              <path
                d="M150 46 C100 46 70 96 70 160 C70 208 82 236 96 262 C108 284 122 306 136 322 C142 330 158 330 164 322 C178 306 192 284 204 262 C218 236 230 208 230 160 C230 96 200 46 150 46 Z"
                fill="none"
                stroke={capturing ? "#39d98a" : "rgba(245,181,27,0.65)"}
                strokeWidth={2.5}
              />
            </svg>
            {!ready && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  color: "#aaa",
                  background: "rgba(0,0,0,0.72)",
                  fontSize: 13,
                  padding: 16,
                  textAlign: "center",
                }}
              >
                Starting camera…
              </div>
            )}
            {ready && modelState === "loading" && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: "8px 10px",
                  background: "rgba(0,0,0,0.55)",
                  color: "#ccc",
                  fontSize: 11,
                  textAlign: "center",
                }}
              >
                Loading face pose model…
              </div>
            )}
          </div>

          <p
            style={{
              textAlign: "center",
              color: capturing ? "#39d98a" : "#ccc",
              fontSize: 13,
              minHeight: 20,
              margin: "0 0 8px",
              fontWeight: capturing ? 700 : 400,
            }}
          >
            {status}
          </p>
          {/* Subtle debug only while developing — remove or gate if preferred */}
          {modelState === "ready" && import.meta.env.DEV && (
            <p style={{ textAlign: "center", color: "#444", fontSize: 10, margin: 0 }}>
              yaw {poseDebug.yaw.toFixed(2)} · pitch {poseDebug.pitch.toFixed(2)}
            </p>
          )}
        </>
      )}

      <button
        type="button"
        style={{ ...s.secondaryBtn, marginTop: 12 }}
        onClick={() => {
          stopCamera();
          onCancel();
        }}
      >
        Cancel
      </button>
    </div>
  );
}
