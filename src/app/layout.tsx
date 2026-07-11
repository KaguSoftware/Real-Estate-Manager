import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "@/src/components/auth/AuthProvider";
import { ToastHost } from "@/src/components/ui/Toast";
import { OfflineBanner } from "@/src/components/ui/OfflineBanner";
import { TrialBanner } from "@/src/components/billing/TrialBanner";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-latin" });
// Serif display face for headings — the luxury signature (.font-display).
const playfair = Playfair_Display({ subsets: ["latin", "latin-ext"], variable: "--font-display-face" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700", "900"], variable: "--font-arabic" });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://kagu.app";

export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: {
		default: "Kagu Emlak — Emlak ofisiniz için tek uygulama",
		template: "%s — Kagu Emlak",
	},
	description:
		"Portföy yönetimi, müşteri takibi (CRM), kiracı ve tahsilat yönetimi, sözleşme PDF'leri — emlak ofisleri için hepsi bir arada.",
	openGraph: {
		type: "website",
		locale: "tr_TR",
		siteName: "Kagu Emlak",
		title: "Kagu Emlak — Emlak ofisiniz için tek uygulama",
		description:
			"Portföy, müşteri, kiracı, tahsilat ve sözleşmeler — ekibinizle birlikte, tek bir yerde.",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	// Light is the default; the boot script swaps this for explicit dark
	// users before paint.
	themeColor: "#f4f1ea",
};

// Light is the default (no attribute needed). Only an explicit "dark" choice
// sets the attribute — before first paint, so there is no flash.
const themeBootScript = `try{if(localStorage.getItem("kagu-theme")==="dark")document.documentElement.setAttribute("data-theme","estate-dark");}catch(e){}`;

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="tr" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
			</head>
			<body
				className={`${jakarta.variable} ${playfair.variable} ${notoArabic.variable} bg-base-200 text-base-content antialiased overflow-x-hidden`}
				style={{ fontFamily: "var(--font-latin), var(--font-arabic), sans-serif" }}
			>
				<AuthProvider>
					<TrialBanner />
					{children}
				</AuthProvider>
				<OfflineBanner />
				<ToastHost />
			</body>
		</html>
	);
}
