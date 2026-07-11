import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth/AuthForm";
import { Card } from "@/src/components/ui";

export const metadata: Metadata = { title: "Create your account — Kagu" };

export default function SignupPage() {
	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-4">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
					<p className="text-sm text-slate-500 mt-1">
						Start your agency&apos;s 14-day free trial — no credit card required.
					</p>
				</div>
				<Card>
					<AuthForm mode="signup" />
				</Card>
			</div>
		</div>
	);
}
