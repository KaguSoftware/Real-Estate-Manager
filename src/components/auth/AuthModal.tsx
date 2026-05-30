"use client";

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { Sheet, Button, FormField, Input, cn } from "@/src/components/ui";

interface AuthModalProps {
  onClose: () => void;
}

type Tab = "signin" | "signup";
type SignInMode = "password" | "magic";

export function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<Tab>("signin");
  const [signInMode, setSignInMode] = useState<SignInMode>("password");

  // Shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  function reset() {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setStatus("idle");
    setErrorMsg("");
    setSuccessMsg("");
  }

  function switchTab(t: Tab) {
    setTab(t);
    setSignInMode("password");
    reset();
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setStatus("error"); setErrorMsg(error.message); }
    else { setStatus("done"); onClose(); }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setStatus("error"); setErrorMsg(error.message); }
    else { setStatus("done"); setSuccessMsg(`Magic link sent to ${email.trim()}. Check your inbox.`); }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus("error");
      setErrorMsg("Passwords do not match.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setStatus("error"); setErrorMsg(error.message); }
    else { setStatus("done"); setSuccessMsg("Check your email to confirm your account before signing in."); }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => switchTab(t)}
      className={cn(
        "flex-1 h-9 text-sm font-semibold rounded-lg transition-colors",
        tab === t ? "bg-white text-slate-800 shadow-soft" : "text-slate-500 hover:text-slate-700",
      )}
    >
      {label}
    </button>
  );

  return (
    <Sheet open onClose={onClose} title="Account">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-xl p-1">
        {tabBtn("signin", "Sign In")}
        {tabBtn("signup", "Sign Up")}
      </div>

      {/* ── Sign In tab ── */}
      {tab === "signin" && (
        <>
          {status === "done" && successMsg ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">📧</div>
              <p className="text-slate-700 font-medium">{successMsg}</p>
              <Button block variant="outline" onClick={onClose} className="mt-2">Done</Button>
            </div>
          ) : signInMode === "password" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <FormField label="Email address">
                <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </FormField>
              <FormField label="Password">
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </FormField>
              {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
              <Button type="submit" block loading={status === "loading"}>Sign In</Button>
              <div className="text-center">
                <button type="button" onClick={() => { setSignInMode("magic"); reset(); }}
                  className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
                  Send magic link instead
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <p className="text-sm text-slate-500">
                Enter your email and we&apos;ll send you a sign-in link — no password needed.
              </p>
              <FormField label="Email address">
                <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </FormField>
              {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
              <Button type="submit" block loading={status === "loading"}>Send magic link</Button>
              <div className="text-center">
                <button type="button" onClick={() => { setSignInMode("password"); reset(); }}
                  className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2">
                  Back to password sign in
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* ── Sign Up tab ── */}
      {tab === "signup" && (
        <>
          {status === "done" ? (
            <div className="text-center space-y-3">
              <div className="text-4xl">✉️</div>
              <p className="text-slate-700 font-medium">{successMsg}</p>
              <Button block variant="outline" onClick={onClose} className="mt-2">Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <FormField label="Email address">
                <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </FormField>
              <FormField label="Password">
                <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </FormField>
              <FormField label="Confirm password">
                <Input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" />
              </FormField>
              {status === "error" && <p className="text-sm text-red-600">{errorMsg}</p>}
              <Button type="submit" block loading={status === "loading"}>Create Account</Button>
            </form>
          )}
        </>
      )}
    </Sheet>
  );
}
