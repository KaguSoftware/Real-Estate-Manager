/**
 * LandingPage — the signed-out face of the product at "/". Server-rendered,
 * fully static (SEO). Pricing mirrors public.plans seed data (0010) — update
 * both together.
 */

import Link from "next/link";
import {
	Building2,
	Users,
	FileText,
	Wallet,
	BellRing,
	Smartphone,
	CheckCircle2,
} from "lucide-react";
import { PublicShell } from "./PublicShell";

const FEATURES = [
	{
		icon: Building2,
		title: "Portföy yönetimi",
		body: "Satılık ve kiralık taşınmazlarınız; tapu bilgileri, fotoğraflar ve harita üzerinde konumlarıyla tek yerde.",
	},
	{
		icon: Users,
		title: "Müşteri takibi (CRM)",
		body: "Müşteri tercihleri portföyünüzle otomatik eşleşir; kimi ne zaman aradığınızı tek dokunuşla kaydedin.",
	},
	{
		icon: FileText,
		title: "Sözleşme ve belgeler",
		body: "Kira sözleşmesi, satış sözleşmesi ve tahsilat makbuzunu dakikalar içinde PDF olarak oluşturun — Arapça desteğiyle.",
	},
	{
		icon: Wallet,
		title: "Kira ve tahsilat",
		body: "Kiracılar, kira dönemleri ve ödemeler; geciken tahsilatlar panonuzda öne çıkar.",
	},
	{
		icon: BellRing,
		title: "Akıllı hatırlatmalar",
		body: "Süresi dolan sözleşmeler, vadesi gelen kiralar ve sessiz kalan müşteriler gözden kaçmaz.",
	},
	{
		icon: Smartphone,
		title: "Telefonda kusursuz",
		body: "Sahada, tapuda, müşteri yanında — tüm özellikler mobil için tasarlandı.",
	},
];

const PLANS = [
	{
		name: "Starter",
		price: "₺499",
		seats: "3 danışmana kadar",
		highlight: false,
	},
	{
		name: "Pro",
		price: "₺1.499",
		seats: "Sınırsız danışman",
		highlight: true,
	},
];

export function LandingPage() {
	return (
		<PublicShell>
			{/* Hero */}
			<section className="mx-auto max-w-6xl safe-x pt-16 sm:pt-28 pb-14 text-center">
				<p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary/90">
					Emlak ofisleri için
				</p>
				<h1 className="font-display mt-4 text-4xl sm:text-6xl font-semibold tracking-tight text-base-content leading-[1.08]">
					Portföyünüzü zarafetle
					<br />
					<span className="text-primary italic">yönetin</span>
				</h1>
				<p className="mt-5 sm:mt-7 max-w-2xl mx-auto text-base sm:text-lg text-base-content/70 leading-relaxed">
					Portföy, müşteri, kiracı, tahsilat ve sözleşmeler — dağınık Excel dosyaları
					ve WhatsApp notları yerine, ekibinizle birlikte çalıştığınız tek bir yer.
				</p>
				<div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
					<Link
						href="/signup"
						className="w-full sm:w-auto px-8 h-12 inline-flex items-center justify-center rounded-xl text-base font-semibold bg-primary text-primary-content hover:opacity-90 transition-opacity"
					>
						14 gün ücretsiz deneyin
					</Link>
					<Link
						href="/login"
						className="w-full sm:w-auto px-8 h-12 inline-flex items-center justify-center rounded-xl text-base font-semibold border border-base-300 text-base-content hover:bg-base-100 transition-colors"
					>
						Giriş yap
					</Link>
				</div>
				<p className="mt-3 text-sm text-base-content/50">
					Kredi kartı gerekmez · Kurulum gerektirmez · Dilediğinizde iptal edin
				</p>
			</section>

			{/* Features */}
			<section className="mx-auto max-w-6xl safe-x py-12">
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{FEATURES.map(({ icon: Icon, title, body }) => (
						<div key={title} className="rounded-2xl bg-base-100 border border-base-300/70 p-7 shadow-card transition-colors hover:border-primary/40">
							<span className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
								<Icon className="w-5 h-5" />
							</span>
							<h3 className="font-display mt-5 text-lg font-semibold text-base-content">{title}</h3>
							<p className="mt-2 text-sm text-base-content/70 leading-relaxed">{body}</p>
						</div>
					))}
				</div>
			</section>

			{/* Pricing */}
			<section className="mx-auto max-w-4xl safe-x py-12" id="fiyatlar">
				<h2 className="font-display text-3xl sm:text-4xl font-semibold text-center text-base-content">
					Basit, şeffaf fiyatlandırma
				</h2>
				<p className="mt-2 text-center text-base-content/60">
					Her plan 14 günlük ücretsiz deneme ile başlar.
				</p>
				<div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
					{PLANS.map((p) => (
						<div
							key={p.name}
							className={`rounded-2xl bg-base-100 border p-6 sm:p-8 shadow-soft ${
								p.highlight ? "border-primary ring-2 ring-primary/20" : "border-base-300"
							}`}
						>
							<h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary/90">{p.name}</h3>
							<p className="font-display mt-4 text-5xl font-semibold text-base-content">
								{p.price}
								<span className="font-sans text-base font-normal text-base-content/50"> / ay</span>
							</p>
							<ul className="mt-5 space-y-2.5 text-sm text-base-content/80">
								<li className="flex items-center gap-2">
									<CheckCircle2 className="w-4 h-4 text-success shrink-0" /> {p.seats}
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle2 className="w-4 h-4 text-success shrink-0" /> Sınırsız taşınmaz ve müşteri
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle2 className="w-4 h-4 text-success shrink-0" /> Sözleşme ve makbuz PDF&apos;leri
								</li>
								<li className="flex items-center gap-2">
									<CheckCircle2 className="w-4 h-4 text-success shrink-0" /> CSV dışa aktarma
								</li>
							</ul>
							<Link
								href="/signup"
								className={`mt-6 w-full h-11 inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-opacity ${
									p.highlight
										? "bg-primary text-primary-content hover:opacity-90"
										: "border border-base-300 text-base-content hover:bg-base-200"
								}`}
							>
								Ücretsiz başlayın
							</Link>
						</div>
					))}
				</div>
			</section>

			{/* Bottom CTA */}
			<section className="mx-auto max-w-6xl safe-x py-14">
				<div className="rounded-3xl bg-primary text-primary-content px-6 py-12 sm:px-12 text-center shadow-pop">
					<h2 className="font-display text-3xl sm:text-4xl font-semibold">Bugün deneyin, ekibinizi yarın davet edin</h2>
					<p className="mt-3 opacity-90">14 gün ücretsiz — kart bilgisi istemiyoruz.</p>
					<Link
						href="/signup"
						className="mt-6 inline-flex px-8 h-12 items-center justify-center rounded-xl text-base font-semibold bg-base-100 text-base-content hover:opacity-90 transition-opacity"
					>
						Hemen başlayın
					</Link>
				</div>
			</section>
		</PublicShell>
	);
}
