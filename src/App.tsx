import { useState } from "react";
import AuthScreen from "@/components/auth/AuthScreen";

export default function App() {
  const [page, setPage] = useState<"auth" | "terms" | "privacy">("auth");

  if (page === "terms") {
    return (
      <div className="min-h-screen bg-[#080808] text-white p-6">
        <button
          onClick={() => setPage("auth")}
          className="mb-8 rounded-lg border border-[#c9a24a] px-4 py-2 text-[#e4c56a]"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-semibold text-[#e4c56a]">
          Terms of Service
        </h1>
        <p className="mt-4 text-white/70">
          Please review the CEO Exchange Terms of Service before creating your
          account.
        </p>
      </div>
    );
  }

  if (page === "privacy") {
    return (
      <div className="min-h-screen bg-[#080808] text-white p-6">
        <button
          onClick={() => setPage("auth")}
          className="mb-8 rounded-lg border border-[#c9a24a] px-4 py-2 text-[#e4c56a]"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-semibold text-[#e4c56a]">
          Privacy Policy
        </h1>
        <p className="mt-4 text-white/70">
          Please review the CEO Exchange Privacy Policy before creating your
          account.
        </p>
      </div>
    );
  }

  return (
    <AuthScreen
      onAuth={() => {
        // Authentication-only phase.
        // The full application will be connected here later.
      }}
      onNavigateTerms={() => setPage("terms")}
      onNavigatePrivacy={() => setPage("privacy")}
    />
  );
}
