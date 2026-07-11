import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth/AuthForm";
import { Alert, Card } from "@/src/components/ui";

export const metadata: Metadata = { title: "Sign in — Kagu" };

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ next?: string; error?: string }>;
}) {
	const { next, error } = await searchParams;
	// Only allow internal redirects.
	const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-4">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
					<p className="text-sm text-slate-500 mt-1">Sign in to your Kagu workspace.</p>
				</div>
				{error === "confirm" && (
					<Alert>
						That confirmation link has expired or was already used. Sign in below,
						or create your account again to get a fresh link.
					</Alert>
				)}
				<Card>
					<AuthForm mode="login" next={safeNext} />
				</Card>
			</div>
		</div>
	);
}
