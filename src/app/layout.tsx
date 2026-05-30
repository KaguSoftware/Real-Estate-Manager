import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AuthProvider } from "@/src/components/auth/AuthProvider";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-latin" });
const notoArabic = Noto_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700", "900"], variable: "--font-arabic" });

export const metadata: Metadata = {
	title: "Real Estate Manager",
	description: "Property management and document generation",
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#ffffff",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" data-theme="estate">
			<body
				className={`${jakarta.variable} ${notoArabic.variable} bg-base-200 text-base-content antialiased overflow-x-hidden`}
				style={{ fontFamily: "var(--font-latin), var(--font-arabic), sans-serif" }}
			>
				<AuthProvider>{children}</AuthProvider>
			</body>
		</html>
	);
}
