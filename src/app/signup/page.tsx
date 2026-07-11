import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth/AuthForm";
import { Card } from "@/src/components/ui";

export const metadata: Metadata = { title: "Hesabınızı oluşturun — Kagu" };

export default function SignupPage() {
	return (
		<div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
			<div className="w-full max-w-md space-y-5">
				<div className="text-center">
					<h1 className="font-display text-2xl font-semibold text-base-content">Hesabınızı oluşturun</h1>
					<p className="text-sm text-base-content/60 mt-1">
						Ofisiniz için 14 günlük ücretsiz denemeyi başlatın — kredi kartı gerekmez.
					</p>
				</div>
				<Card>
					<AuthForm mode="signup" />
				</Card>
			</div>
		</div>
	);
}
