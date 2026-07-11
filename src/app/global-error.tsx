"use client";

/**
 * Last-resort error boundary — replaces the root layout entirely when even it
 * crashes, so this file carries its own minimal <html>/<body> and inline
 * styles (globals.css may not have loaded).
 */

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<html lang="tr">
			<body
				style={{
					margin: 0,
					minHeight: "100dvh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "system-ui, -apple-system, sans-serif",
					background: "#17140e",
					color: "#efeadf",
				}}
			>
				<div style={{ textAlign: "center", padding: "2rem", maxWidth: 420 }}>
					<div style={{ fontSize: 44 }}>⚠️</div>
					<h1 style={{ fontSize: 20, fontWeight: 700, margin: "1rem 0 0.5rem" }}>
						Beklenmeyen bir hata oluştu
					</h1>
					<p style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>
						Sorun bize otomatik olarak bildirildi. Sayfayı yeniden yüklemeyi
						deneyin; sorun sürerse kısa bir süre sonra tekrar deneyin.
					</p>
					<button
						onClick={reset}
						style={{
							marginTop: "1.25rem",
							padding: "0.65rem 1.5rem",
							borderRadius: 10,
							border: "none",
							background: "#d9b96a",
							color: "#241d0f",
							fontSize: 14,
							fontWeight: 600,
							cursor: "pointer",
						}}
					>
						Yeniden dene
					</button>
				</div>
			</body>
		</html>
	);
}
