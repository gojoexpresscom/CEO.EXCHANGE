import React, { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT, BG, CARD, BORDER } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import LivenessCapture from "./LivenessCapture";
import { checkDocumentImageQuality } from "./docQuality";

type Props = {
  userId: string;
  currentStatus: string | null;
  onClose: () => void;
  onSubmitted: () => void;
  notify: (msg: string) => void;
};

type DocType = "passport" | "national_id" | "license";
type Step = "type" | "form" | "docs" | "liveness" | "done";

const DOC_LABELS: Record<DocType, string> = {
  passport: "Passport",
  national_id: "National ID",
  license: "Driver license",
};

const DOC_DESCRIPTIONS: Record<DocType, string> = {
  passport: "International travel document",
  national_id: "Government-issued ID card",
  license: "Front and back required",
};

const DOC_ICON: Record<DocType, string> = {
  passport: "globe",
  national_id: "id",
  license: "id",
};

const STEP_ORDER: Step[] = ["type", "form", "docs", "liveness"];
const STEP_LABEL: Record<Step, string> = {
  type: "Document",
  form: "Details",
  docs: "Photos",
  liveness: "Verify",
  done: "Done",
};

// Injected once - keyframes can't live in inline style objects.
const KYC_ANIMATIONS = `
@keyframes kycStepIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes kycFieldIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes kycScan {
  0% { transform: translateY(-100%); opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateY(100%); opacity: 0; }
}
@keyframes kycPulseRing {
  0% { box-shadow: 0 0 0 0 rgba(245,181,27,0.35); }
  100% { box-shadow: 0 0 0 10px rgba(245,181,27,0); }
}
@keyframes kycCheckPop {
  0% { transform: scale(0.4); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
`;

export default function KycFlow({ userId, currentStatus, onClose, onSubmitted, notify }: Props) {
  const [step, setStep] = useState<Step>("type");
  const [docType, setDocType] = useState<DocType>("passport");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dob, setDob] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [livenessUrls, setLivenessUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkingFront, setCheckingFront] = useState(false);
  const [checkingBack, setCheckingBack] = useState(false);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const needsBack = docType !== "passport";
  const idLabel =
    docType === "passport" ? "Passport number" : docType === "national_id" ? "National ID number" : "License number";

  const uploadPrivate = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${folder}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    return path;
  };

  // Runs a free, in-browser blur + "is there actually text here" check before
  // accepting a document photo, and shows an instant thumbnail preview.
  const handleDocFile = async (file: File | null, side: "front" | "back") => {
    setError("");
    const setChecking = side === "front" ? setCheckingFront : setCheckingBack;
    const setFile = side === "front" ? setFrontFile : setBackFile;
    const setPreview = side === "front" ? setFrontPreview : setBackPreview;
    const prevPreview = side === "front" ? frontPreview : backPreview;

    if (prevPreview) URL.revokeObjectURL(prevPreview);

    if (!file) {
      setFile(null);
      setPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setChecking(true);
    const result = await checkDocumentImageQuality(file);
    setChecking(false);

    if (!result.ok) {
      setError(result.reason || "This photo isn't clear enough. Please retake it.");
      setFile(null);
      setPreview(null);
      URL.revokeObjectURL(objectUrl);
      const ref = side === "front" ? frontRef : backRef;
      if (ref.current) ref.current.value = "";
      return;
    }
    setFile(file);
  };

  const clearDoc = (side: "front" | "back") => {
    const ref = side === "front" ? frontRef : backRef;
    if (ref.current) ref.current.value = "";
    void handleDocFile(null, side);
  };

  const submit = async (livenessPaths: string[]) => {
    setError("");
    if (!fullName.trim() || !idNumber.trim() || !dob) {
      setError("Fill in full legal name, ID number, and date of birth.");
      return;
    }
    if (!frontFile) {
      setError("Front of document is required.");
      return;
    }
    if (needsBack && !backFile) {
      setError("Back of document is required for this document type.");
      return;
    }
    if (livenessPaths.length < 5) {
      setError("Complete all five liveness captures first.");
      return;
    }

    setBusy(true);
    try {
      const frontPath = await uploadPrivate(frontFile, "front");
      const backPath = backFile ? await uploadPrivate(backFile, "back") : null;

      const { data: res, error: fnErr } = await supabase.functions.invoke("verify-kyc", {
        body: {
          document_type: docType,
          full_name: fullName.trim(),
          id_number: idNumber.trim(),
          date_of_birth: dob,
          front_image_url: frontPath,
          back_image_url: backPath,
          // No selfie upload - liveness captures are the face evidence
          selfie_url: null,
          liveness_passed: true,
          liveness_capture_urls: livenessPaths,
        },
      });
      if (fnErr) throw fnErr;
      if (res?.submitted === false) throw new Error(res?.reason || "Submission was not accepted.");

      setStep("done");
      notify("Identity verification submitted for review.");
    } catch (e: any) {
      setError(e?.message || "Submission failed. Check files and try again.");
      setStep("docs");
    } finally {
      setBusy(false);
    }
  };

  if (step === "liveness") {
    return (
      <LivenessCapture
        userId={userId}
        onComplete={(urls) => {
          setLivenessUrls(urls);
          void submit(urls);
        }}
        onCancel={() => setStep("docs")}
        notify={notify}
      />
    );
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div style={{ ...kyc.page }}>
      <style>{KYC_ANIMATIONS}</style>

      <button
        type="button"
        style={{ ...s.secondaryBtn, marginBottom: 14, width: "auto", padding: "8px 12px" }}
        onClick={onClose}
      >
        ← Back to My Info
      </button>

      {step !== "done" && (
        <div style={kyc.stepper}>
          {STEP_ORDER.map((st, i) => (
            <div key={st} style={kyc.stepperItem}>
              <div
                style={{
                  ...kyc.stepperTrack,
                  background: i <= stepIndex ? `linear-gradient(90deg,${GOLD},${GOLD_LIGHT})` : "#1c1c1c",
                }}
              />
              <span style={{ ...kyc.stepperLabel, color: i <= stepIndex ? GOLD_LIGHT : "#555" }}>
                {STEP_LABEL[st]}
              </span>
            </div>
          ))}
        </div>
      )}

      {currentStatus && step === "type" && (
        <div style={s.infoBox}>
          Current status: <strong style={{ color: GOLD }}>{currentStatus}</strong>
        </div>
      )}

      <div key={step} style={kyc.animatedStep}>
        {step === "type" && (
          <>
            <h3 style={kyc.stepTitle}>Choose document type</h3>
            <p style={kyc.stepSubtitle}>Pick the ID you'll use to verify your identity.</p>
            {(Object.keys(DOC_LABELS) as DocType[]).map((t, i) => (
              <button
                key={t}
                type="button"
                style={{
                  ...kyc.docCard,
                  ...(docType === t ? kyc.docCardActive : {}),
                  animation: `kycFieldIn 0.3s ease-out both`,
                  animationDelay: `${i * 0.05}s`,
                }}
                onClick={() => setDocType(t)}
              >
                <span
                  style={{
                    ...kyc.docCardIcon,
                    ...(docType === t ? { background: "rgba(245,181,27,0.16)", color: GOLD_LIGHT } : {}),
                  }}
                >
                  <SIcon name={DOC_ICON[t]} size={20} />
                </span>
                <span style={{ flex: 1, textAlign: "left" }}>
                  <div style={kyc.docCardTitle}>{DOC_LABELS[t]}</div>
                  <div style={kyc.docCardSubtitle}>{DOC_DESCRIPTIONS[t]}</div>
                </span>
                {docType === t && (
                  <span style={{ color: GOLD, animation: "kycCheckPop 0.25s ease-out both" }}>
                    <SIcon name="check" size={18} />
                  </span>
                )}
              </button>
            ))}
            <button type="button" style={s.primaryBtn} onClick={() => setStep("form")}>
              Continue
            </button>
          </>
        )}

        {step === "form" && (
          <>
            <h3 style={kyc.stepTitle}>Your legal details</h3>
            <div style={s.infoBox}>
              Legal name is for KYC and admin review only. It is never shown on your public profile.
            </div>
            {[
              { label: "Full legal name", value: fullName, onChange: setFullName, type: "text", auto: "name" },
              { label: idLabel, value: idNumber, onChange: setIdNumber, type: "text", auto: "off" },
              { label: "Date of birth", value: dob, onChange: setDob, type: "date", auto: "off" },
            ].map((f, i) => (
              <label
                key={f.label}
                style={{ ...kyc.field, animation: "kycFieldIn 0.3s ease-out both", animationDelay: `${i * 0.05}s` }}
              >
                <span style={kyc.fieldLabel}>{f.label}</span>
                <input
                  style={kyc.input}
                  type={f.type}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                  autoComplete={f.auto}
                />
              </label>
            ))}
            {error && <div style={s.errorBox}>{error}</div>}
            <button
              type="button"
              style={s.primaryBtn}
              onClick={() => {
                if (!fullName.trim() || !idNumber.trim() || !dob) {
                  setError("Fill in full legal name, ID number, and date of birth.");
                  return;
                }
                setError("");
                setStep("docs");
              }}
            >
              Continue to photos
            </button>
            <button type="button" style={s.secondaryBtn} onClick={() => setStep("type")}>
              Back
            </button>
          </>
        )}

        {step === "docs" && (
          <>
            <h3 style={kyc.stepTitle}>Photograph your document</h3>
            <p style={kyc.stepSubtitle}>Place it on a flat, well-lit surface. Avoid glare and shadows.</p>

            <input
              ref={frontRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => void handleDocFile(e.target.files?.[0] ?? null, "front")}
            />
            <input
              ref={backRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => void handleDocFile(e.target.files?.[0] ?? null, "back")}
            />

            <DocUploadTile
              label="Front of document"
              preview={frontPreview}
              checking={checkingFront}
              ok={!!frontFile}
              onChoose={() => frontRef.current?.click()}
              onRetake={() => clearDoc("front")}
            />
            {needsBack && (
              <DocUploadTile
                label="Back of document"
                preview={backPreview}
                checking={checkingBack}
                ok={!!backFile}
                onChoose={() => backRef.current?.click()}
                onRetake={() => clearDoc("back")}
              />
            )}

            <p style={{ color: "#666", fontSize: 12, margin: "10px 0 0", textAlign: "center" }}>
              Photos are checked for blur and readability as soon as you choose them.
            </p>

            {error && <div style={s.errorBox}>{error}</div>}
            {busy && <div style={s.infoBox}>Submitting verification…</div>}

            <button
              type="button"
              style={s.primaryBtn}
              disabled={busy || checkingFront || checkingBack}
              onClick={() => {
                if (!frontFile) {
                  setError("Front of document is required.");
                  return;
                }
                if (needsBack && !backFile) {
                  setError("Back of document is required for this document type.");
                  return;
                }
                setError("");
                setStep("liveness");
              }}
            >
              Continue to verification
            </button>
            <button type="button" style={s.secondaryBtn} onClick={() => setStep("form")}>
              Back
            </button>
          </>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "24px 8px" }}>
            <div style={kyc.doneBadge}>
              <SIcon name="check" size={30} />
            </div>
            <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 18 }}>Verification completed</h3>
            <p style={{ color: "#999", fontSize: 13, lineHeight: 1.5, margin: "0 0 12px" }}>
              Your identity verification has been submitted for review.
            </p>
            <span style={kyc.donePill}>Status: Pending</span>
            <button type="button" style={{ ...s.primaryBtn, marginTop: 20 }} onClick={onSubmitted}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DocUploadTile({
  label,
  preview,
  checking,
  ok,
  onChoose,
  onRetake,
}: {
  label: string;
  preview: string | null;
  checking: boolean;
  ok: boolean;
  onChoose: () => void;
  onRetake: () => void;
}) {
  return (
    <div style={kyc.uploadTile}>
      <button
        type="button"
        style={{ ...kyc.uploadThumb, cursor: preview ? "default" : "pointer" }}
        onClick={() => {
          if (!preview) onChoose();
        }}
      >
        {preview ? (
          <img src={preview} alt={label} style={kyc.uploadImg} />
        ) : (
          <span style={{ color: "#666", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <SIcon name="camera" size={22} />
            <span style={{ fontSize: 12 }}>Tap to capture</span>
          </span>
        )}
        {checking && (
          <div style={kyc.scanOverlay}>
            <div style={kyc.scanLine} />
          </div>
        )}
        {ok && !checking && (
          <div style={kyc.uploadCheck}>
            <SIcon name="check" size={14} />
          </div>
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#eee" }}>{label}</div>
        <div style={{ fontSize: 12, color: checking ? GOLD_LIGHT : ok ? "#39d98a" : "#777", marginTop: 2 }}>
          {checking ? "Checking image quality…" : ok ? "Looks good" : "Not selected"}
        </div>
        {preview && (
          <button type="button" onClick={onRetake} style={kyc.retakeBtn}>
            Retake
          </button>
        )}
      </div>
    </div>
  );
}

const kyc: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    background: BG,
    minHeight: "100%",
  },
  stepper: {
    display: "flex",
    gap: 8,
    marginBottom: 18,
  },
  stepperItem: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  stepperTrack: {
    height: 3,
    borderRadius: 99,
    transition: "background 0.35s ease",
  },
  stepperLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    transition: "color 0.35s ease",
  },
  animatedStep: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    animation: "kycStepIn 0.32s cubic-bezier(0.16,1,0.3,1) both",
  },
  stepTitle: {
    margin: "0 0 4px",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
  },
  stepSubtitle: {
    margin: "0 0 14px",
    color: "#888",
    fontSize: 13,
    lineHeight: 1.4,
  },
  docCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 64,
    padding: "12px 14px",
    borderRadius: 16,
    background: CARD,
    border: "1px solid transparent",
    color: "#ddd",
    textAlign: "left",
    cursor: "pointer",
    marginBottom: 10,
    transition: "border-color 0.2s, background 0.2s",
  },
  docCardActive: {
    border: `1px solid ${GOLD}`,
    background: "#151008",
  },
  docCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "#17130a",
    border: `1px solid ${BORDER}`,
    display: "grid",
    placeItems: "center",
    color: "#999",
    flexShrink: 0,
  },
  docCardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#f2f2f2",
  },
  docCardSubtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    margin: "0 0 14px",
  },
  fieldLabel: {
    color: "#999",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    width: "100%",
    minHeight: 50,
    border: `1px solid ${BORDER}`,
    borderRadius: 13,
    outline: 0,
    background: "#0d0d0d",
    color: "#fff",
    padding: "13px 15px",
    fontSize: 15,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  uploadTile: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "12px",
    borderRadius: 16,
    background: CARD,
    border: `1px solid ${BORDER}`,
    marginBottom: 12,
  },
  uploadThumb: {
    position: "relative",
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: "hidden",
    background: "#0d0d0d",
    border: "1px solid #222",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    padding: 0,
  },
  uploadImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  scanOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: "34%",
    background: "linear-gradient(180deg, rgba(245,181,27,0), rgba(245,181,27,0.55), rgba(245,181,27,0))",
    animation: "kycScan 1.1s ease-in-out infinite",
  },
  uploadCheck: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: "50%",
    background: "#123023",
    color: "#39d98a",
    display: "grid",
    placeItems: "center",
    animation: "kycCheckPop 0.25s ease-out both",
  },
  retakeBtn: {
    marginTop: 6,
    border: 0,
    background: "transparent",
    color: GOLD_LIGHT,
    fontSize: 12,
    fontWeight: 700,
    padding: 0,
    cursor: "pointer",
  },
  doneBadge: {
    width: 64,
    height: 64,
    margin: "0 auto 14px",
    borderRadius: "50%",
    background: "#13251e",
    color: "#39d98a",
    display: "grid",
    placeItems: "center",
    animation: "kycCheckPop 0.4s ease-out both, kycPulseRing 1.6s ease-out 0.4s infinite",
  },
  donePill: {
    display: "inline-block",
    padding: "6px 14px",
    borderRadius: 99,
    background: "#17130a",
    border: `1px solid ${GOLD}`,
    color: GOLD_LIGHT,
    fontWeight: 700,
    fontSize: 13,
  },
};
