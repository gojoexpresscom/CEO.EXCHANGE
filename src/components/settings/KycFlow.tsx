import React, { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import LivenessCapture from "./LivenessCapture";

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
  const [step, setStep] = useState<"type" | "form" | "docs" | "liveness" | "review">("type");
  const [docType, setDocType] = useState<DocType>("passport");
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [dob, setDob] = useState("");
  const [expiry, setExpiry] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [livenessUrls, setLivenessUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  const needsBack = docType !== "passport";

  const uploadPrivate = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${userId}/${folder}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw upErr;
    // Private bucket — store path only; never construct a public URL.
    return path;
  };

  const submit = async () => {
    setError("");
    if (!fullName.trim() || !idNumber.trim() || !dob) {
      setError("Fill in full name, ID number, and date of birth.");
      return;
    }
    if (!frontFile || !selfieFile) {
      setError("Front document photo and selfie are required.");
      return;
    }
    if (needsBack && !backFile) {
      setError("Back of document is required for this document type.");
      return;
    }
    if (livenessUrls.length < 4) {
      setError("Complete the 4-direction liveness capture first.");
      return;
    }

    setBusy(true);
    try {
      const frontPath = await uploadPrivate(frontFile, "front");
      const backPath = backFile ? await uploadPrivate(backFile, "back") : null;
      const selfiePath = await uploadPrivate(selfieFile, "selfie");

      const { data: res, error: fnErr } = await supabase.functions.invoke("verify-kyc", {
        body: {
          document_type: docType,
          full_name: fullName.trim(),
          id_number: idNumber.trim(),
          date_of_birth: dob,
          id_expiry_date: expiry || null,
          front_image_url: frontPath,
          back_image_url: backPath,
          selfie_url: selfiePath,
          liveness_passed: true,
          liveness_capture_urls: livenessUrls,
        },
      });
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(res.error);

      onSubmitted();
    } catch (e: any) {
      setError(e?.message || "Submission failed. Check files and try again.");
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
          setStep("review");
        }}
        onCancel={() => setStep("docs")}
        notify={notify}
      />
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
          <label style={s.field}>
            Full legal name
            <input style={s.input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </label>
          <label style={s.field}>
            ID number
            <input style={s.input} value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
          </label>
          <label style={s.field}>
            Date of birth
            <input style={s.input} type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <label style={s.field}>
            ID expiry (optional)
            <input style={s.input} type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          </label>
          {error && <div style={s.errorBox}>{error}</div>}
          <button type="button" style={s.primaryBtn} onClick={() => setStep("docs")}>
            Continue to photos
          </button>
          <button type="button" style={s.secondaryBtn} onClick={() => setStep("type")}>
            Back
          </button>
        </>
      )}

      {step === "docs" && (
        <>
          <input ref={frontRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)} />
          <input ref={backRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setBackFile(e.target.files?.[0] ?? null)} />
          <input ref={selfieRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)} />

          <button type="button" style={s.row} onClick={() => frontRef.current?.click()}>
            <span style={s.rowLabel}>Front of document</span>
            <span style={s.rowValue}>{frontFile ? frontFile.name : "Choose"}</span>
          </button>
          {needsBack && (
            <button type="button" style={s.row} onClick={() => backRef.current?.click()}>
              <span style={s.rowLabel}>Back of document</span>
              <span style={s.rowValue}>{backFile ? backFile.name : "Choose"}</span>
            </button>
          )}
          <button type="button" style={s.row} onClick={() => selfieRef.current?.click()}>
            <span style={s.rowLabel}>Selfie holding document</span>
            <span style={s.rowValue}>{selfieFile ? selfieFile.name : "Choose"}</span>
          </button>

          {error && <div style={s.errorBox}>{error}</div>}
          <button type="button" style={s.primaryBtn} onClick={() => setStep("liveness")}>
            Continue to liveness
          </button>
          <button type="button" style={s.secondaryBtn} onClick={() => setStep("form")}>
            Back
          </button>
        </>
      )}

      {step === "review" && (
        <>
          <div style={s.infoBox}>
            Document: {DOC_LABELS[docType]} · {fullName || "—"} · Liveness captures: {livenessUrls.length}
          </div>
          {error && <div style={s.errorBox}>{error}</div>}
          <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void submit()}>
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          <button type="button" style={s.secondaryBtn} onClick={() => setStep("liveness")}>
            Re-do liveness
          </button>
        </>
      )}
    </div>
  );
}
