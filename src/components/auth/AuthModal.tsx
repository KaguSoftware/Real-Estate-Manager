"use client";

// In-app auth sheet. The actual forms (and the post-auth redirect logic that
// sends team-less users to /onboarding) live in AuthForm, shared with the
// dedicated /login and /signup pages.

import { useState } from "react";
import { Sheet, cn } from "@/src/components/ui";
import { AuthForm, type AuthMode } from "./AuthForm";

interface AuthModalProps {
	onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
	const [mode, setMode] = useState<AuthMode>("login");

	const tabBtn = (m: AuthMode, label: string) => (
		<button
			onClick={() => setMode(m)}
			className={cn(
				"flex-1 h-9 text-sm font-semibold rounded-lg transition-colors",
				mode === m ? "bg-base-100 text-base-content shadow-soft" : "text-base-content/60 hover:text-base-content/80",
			)}
		>
			{label}
		</button>
	);

	return (
		<Sheet open onClose={onClose} title="Hesap">
			<div className="flex gap-1 mb-5 bg-base-200 rounded-xl p-1">
				{tabBtn("login", "Giriş yap")}
				{tabBtn("signup", "Kayıt ol")}
			</div>
			<AuthForm key={mode} mode={mode} standalone={false} onClose={onClose} />
		</Sheet>
	);
}
