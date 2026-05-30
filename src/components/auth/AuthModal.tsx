"use client";

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";

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
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("done");
      onClose();
    }
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

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("done");
      setSuccessMsg(`Magic link sent to ${email.trim()}. Check your inbox.`);
    }
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

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("done");
      setSuccessMsg("Check your email to confirm your account before signing in.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-lg font-semibold text-slate-800">Account</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => switchTab("signin")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === "signin"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => switchTab("signup")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              tab === "signup"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* ── Sign In tab ── */}
        {tab === "signin" && (
          <>
            {status === "done" && successMsg ? (
              <div className="text-center space-y-3">
                <div className="text-3xl">📧</div>
                <p className="text-slate-700 font-medium">{successMsg}</p>
                <button
                  onClick={onClose}
                  className="mt-4 w-full py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : signInMode === "password" ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="si-email">
                    Email address
                  </label>
                  <input
                    id="si-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="si-password">
                    Password
                  </label>
                  <input
                    id="si-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>

                {status === "error" && (
                  <p className="text-xs text-red-600">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-2 rounded-lg bg-primary text-primary-content text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {status === "loading" ? "Signing in…" : "Sign In"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setSignInMode("magic"); reset(); }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                  >
                    Send magic link instead
                  </button>
                </div>
              </form>
            ) : (
              /* Magic link sub-form */
              <form onSubmit={handleMagicLink} className="space-y-4">
                <p className="text-sm text-slate-500">
                  Enter your email and we&apos;ll send you a sign-in link — no password needed.
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="ml-email">
                    Email address
                  </label>
                  <input
                    id="ml-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>

                {status === "error" && (
                  <p className="text-xs text-red-600">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-2 rounded-lg bg-primary text-primary-content text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {status === "loading" ? "Sending…" : "Send magic link"}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => { setSignInMode("password"); reset(); }}
                    className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                  >
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
                <div className="text-3xl">✉️</div>
                <p className="text-slate-700 font-medium text-sm">{successMsg}</p>
                <button
                  onClick={onClose}
                  className="mt-4 w-full py-2 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="su-email">
                    Email address
                  </label>
                  <input
                    id="su-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="su-password">
                    Password
                  </label>
                  <input
                    id="su-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1" htmlFor="su-confirm">
                    Confirm password
                  </label>
                  <input
                    id="su-confirm"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                  />
                </div>

                {status === "error" && (
                  <p className="text-xs text-red-600">{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full py-2 rounded-lg bg-primary text-primary-content text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {status === "loading" ? "Creating account…" : "Create Account"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
