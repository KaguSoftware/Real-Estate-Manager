import type { Metadata } from "next";
import { AuthForm } from "@/src/components/auth/AuthForm";
import { Alert, Card } from "@/src/components/ui";

export const metadata: Metadata = { title: "Giriş yap — Kagu" };

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
					<h1 className="text-2xl font-bold text-base-content">Tekrar hoş geldiniz</h1>
					<p className="text-sm text-base-content/60 mt-1">Kagu çalışma alanınıza giriş yapın.</p>
				</div>
				{error === "confirm" && (
					<Alert>
						Bu doğrulama bağlantısının süresi dolmuş veya bağlantı daha önce kullanılmış.
						Aşağıdan giriş yapın ya da yeni bir bağlantı almak için hesabınızı yeniden oluşturun.
					</Alert>
				)}
				<Card>
					<AuthForm mode="login" next={safeNext} />
				</Card>
			</div>
		</div>
	);
}
