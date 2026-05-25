"use client";

/**
 * UserMenu — shows "Sign in" button when logged out,
 * or the user's email + sign-out when logged in.
 */

import { useState } from "react";
import { createClient } from "@/src/lib/supabase/client";
import { useAppStore } from "@/src/store";
import { AuthModal } from "./AuthModal";

export function UserMenu() {
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);
  const setProperties = useAppStore((s) => s.setProperties);
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setProperties([]);
    setMenuOpen(false);
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-content hover:opacity-90 transition-opacity"
        >
          Sign in
        </button>
        {showModal && <AuthModal onClose={() => setShowModal(false)} />}
      </>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
      >
        {/* Avatar circle with initial */}
        <span className="w-5 h-5 rounded-full bg-primary text-primary-content flex items-center justify-center text-[10px] font-bold uppercase select-none">
          {user.email.charAt(0)}
        </span>
        <span className="hidden sm:block max-w-[120px] truncate text-slate-700">
          {user.email}
        </span>
        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {menuOpen && (
        <>
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-xs font-medium text-slate-700 truncate max-w-[180px]">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
