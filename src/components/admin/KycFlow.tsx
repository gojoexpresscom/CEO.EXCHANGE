import React, { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT } from "./settingsStyles";
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

const DOC_LABELS: Record<DocType, string> = {
  passport: "Passport",
  national_id: "National ID",
  license: "Driver license",
};

export default function KycFlow({ userId, currentStatus, onClose, onSubmitted, notify }: Props) {
  const [step, setStep] = useState<"type" | "form" | "docs" | "liveness" | "done">("type");
  const [docType, setDocType] = useState<DocType>("passport");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dob, setDob] = useState("");
  const [expiry, setExpiry] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [livenessUrls, setLivenessUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkingFront, setCheckingFront] = useState(false);
  const [checkingBack, setCheckingBack] = useState(false);

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  // Runs a free, in-browser blur + "is there actually text here" check before
  // accepting a document photo, so an unusable photo gets rejected immediately
  // instead of only being caught later by an admin.
  const handleDocFile = async (file: File | null, side: "front" | "back") => {
    setError("");
    const setChecking = side === "front" ? setCheckingFront : setCheckingBack;
    const setFile = side === "front" ? setFrontFile : setBackFile;
    if (!file) {
      setFile(null);
      return;
    }
    setChecking(true);
    const result = await checkDocumentImageQuality(file);
    setChecking(false);
    if (!result.ok) {
      setError(result.reason || "This photo isn't clear enough. Please retake it.");
      setFile(null);
      const ref = side === "front" ? frontRef : backRef;
      if (ref.current) ref.current.value = "";
      return;
    }
    setFile(file);
  };

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
          id_expiry_date: expiry || null,
          front_image_url: frontPath,
          back_image_url: backPath,
          // No selfie upload — liveness captures are the face evidence
          selfie_url: null,
          liveness_passed: true,
          liveness_capture_urls: livenessPaths,
        },
      });
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(String(res.error));

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

  if (step === "done") {
    return (
      <div style={s.section}>
        <div style={{ textAlign: "center", padding: "24px 8px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 14px",
              borderRadius: "50%",
              background: "#13251e",
              color: "#39d98a",
              display: "grid",
              placeItems: "center",
              fontSize: 28,
              fontWeight: 900,
            }}
          >
            ✓
          </div>
          <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 18 }}>Verification completed</h3>
          <p style={{ color: "#999", fontSize: 13, lineHeight: 1.5, margin: "0 0 12px" }}>
            Your identity verification has been submitted for review.
          </p>
          <span
            style={{
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: 99,
              background: "#17130a",
              border: `1px solid ${GOLD}`,
              color: GOLD_LIGHT,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Status: Pending
          </span>
        </div>
        <button
          type="button"
          style={s.primaryBtn}
          onClick={() => {
            onSubmitted();
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <button
        type="button"
        style={{ ...s.secondaryBtn, marginBottom: 12, width: "auto", padding: "8px 12px" }}
        onClick={onClose}
      >
        ← Back to My Info
      </button>

      {currentStatus && (
        <div style={s.infoBox}>
          Current status: <strong style={{ color: GOLD }}>{currentStatus}</strong>
        </div>
      )}

      {step === "type" && (
        <>
          <p style={{ color: "#aaa", fontSize: 13, marginBottom: 12 }}>Choose document type</p>
          {(Object.keys(DOC_LABELS) as DocType[]).map((t) => (
            <button
              key={t}
              type="button"
              style={{
                ...s.row,
                border: docType === t ? `1px solid ${GOLD}` : "1px solid transparent",
              }}
              onClick={() => setDocType(t)}
            >
              <span style={s.rowLabel}>{DOC_LABELS[t]}</span>
              {docType === t && <SIcon name="check" size={16} />}
            </button>
          ))}
          <button type="button" style={s.primaryBtn} onClick={() => setStep("form")}>
            Continue
          </button>
        </>
      )}

      {step === "form" && (
        <>
          <div style={s.infoBox}>
            Legal name is for KYC and admin review only. It is never shown on your public profile.
          </div>
          <label style={s.field}>
            Full legal name
            <input style={s.input} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
          <label style={s.field}>
            {idLabel}
            <input style={s.input} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          </label>
          <label style={s.field}>
            Date of birth
            <input style={s.input} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <label style={s.field}>
            Expiry date (if applicable)
            <input style={s.input} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
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

          <button type="button" style={s.row} disabled={checkingFront} onClick={() => frontRef.current?.click()}>
            <span style={s.rowLabel}>Front of document</span>
            <span style={s.rowValue}>{checkingFront ? "Checking…" : frontFile ? frontFile.name : "Choose"}</span>
          </button>
          {needsBack && (
            <button type="button" style={s.row} disabled={checkingBack} onClick={() => backRef.current?.click()}>
              <span style={s.rowLabel}>Back of document</span>
              <span style={s.rowValue}>{checkingBack ? "Checking…" : backFile ? backFile.name : "Choose"}</span>
            </button>
          )}
          <p style={{ color: "#666", fontSize: 12, margin: "4px 0 0" }}>
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
    </div>
  );
}
