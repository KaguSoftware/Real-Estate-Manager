/**
 * LandingPage — the signed-out face of the product at "/". Server-rendered,
 * fully static (SEO). Pricing mirrors public.plans seed data (0010) — update
 * both together.
 *
 * Layout: asymmetric split hero (copy left, live product panel right),
 * rhythmic bento feature grid, two-plan pricing, one drenched CTA block.
 * One signup label page-wide: "Ücretsiz deneyin".
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
	CalendarClock,
	PhoneMissed,
} from "lucide-react";
import { PublicShell } from "./PublicShell";

const SMALL_FEATURES = [
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

/**
 * Real-component product preview: the needs-attention panel rendered with
 * the app's own surface language and mock (clearly illustrative) data.
 */
function AttentionPreview() {
	return (
		<div aria-hidden className="rounded-2xl bg-base-100 border border-base-300/70 shadow-pop p-5">
			<p className="text-sm font-semibold text-base-content/60">Bugün dikkat isteyen</p>
			<ul className="mt-4 space-y-3">
				<li className="flex items-start gap-3 rounded-xl bg-base-200/60 p-3.5">
					<span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-error/10 text-error flex items-center justify-center">
						<Wallet className="w-4 h-4" />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-base-content">Bahçelievler 2+1 — kira gecikti</p>
						<p className="mt-0.5 text-xs text-base-content/60">
							A. Yılmaz · 12 gün · <span className="font-numeric">₺18.500</span>
						</p>
					</div>
				</li>
				<li className="flex items-start gap-3 rounded-xl bg-base-200/60 p-3.5">
					<span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
						<CalendarClock className="w-4 h-4" />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-base-content">Kadıköy ofis — sözleşme bitiyor</p>
						<p className="mt-0.5 text-xs text-base-content/60">28 Şubat · yenileme bekliyor</p>
					</div>
				</li>
				<li className="flex items-start gap-3 rounded-xl bg-base-200/60 p-3.5">
					<span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-base-300 text-base-content/60 flex items-center justify-center">
						<PhoneMissed className="w-4 h-4" />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-base-content">S. Demir — sessiz müşteri</p>
						<p className="mt-0.5 text-xs text-base-content/60">3 haftadır aranmadı · 3+1 arıyor</p>
					</div>
				</li>
			</ul>
		</div>
	);
}

export function LandingPage() {
	return (
		<PublicShell>
			{/* Hero: copy left, product right */}
			<section className="mx-auto max-w-6xl safe-x pt-14 sm:pt-24 pb-16">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
					<div className="lg:col-span-7">
						<h1 className="enter font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-base-content leading-[1.05]">
							Emlak ofisinizin tamamı, tek uygulamada
						</h1>
						<p className="enter enter-2 mt-5 max-w-xl text-base sm:text-lg text-base-content/70 leading-relaxed">
							Portföy, müşteri, kiracı, tahsilat ve sözleşmeler — dağınık Excel
							dosyaları ve WhatsApp notları yerine, ekibinizle birlikte
							çalıştığınız tek bir yer.
						</p>
						<div className="enter enter-3 mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
							<Link
								href="/signup"
								className="w-full sm:w-auto px-8 h-12 inline-flex items-center justify-center rounded-xl text-base font-semibold bg-primary text-primary-content hover:brightness-110 active:scale-[0.98] transition-[filter,transform] shadow-soft"
							>
								Ücretsiz deneyin
							</Link>
							<Link
								href="#fiyatlar"
								className="text-sm font-semibold text-base-content/70 hover:text-base-content underline underline-offset-4 decoration-base-300 hover:decoration-base-content/40 transition-colors"
							>
								Fiyatları görün
							</Link>
						</div>
					</div>
					<div className="enter enter-3 lg:col-span-5">
						<AttentionPreview />
					</div>
				</div>
				<p className="mt-10 text-sm text-base-content/50">
					14 gün ücretsiz · Kredi kartı gerekmez · Dilediğinizde iptal edin
				</p>
			</section>

			{/* Features: bento with rhythm — one wide lead cell, four standard, one dark full-width */}
			<section className="mx-auto max-w-6xl safe-x py-12">
				<h2 className="reveal font-display text-3xl sm:text-4xl font-bold text-base-content max-w-2xl">
					Sahada ve ofiste, işinizin tamamı
				</h2>
				<div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
					{/* Lead cell: portfolio — wide, tinted */}
					<div className="reveal sm:col-span-2 lg:col-span-4 rounded-2xl bg-primary/[0.06] border border-primary/15 p-7 sm:p-9">
						<span className="h-11 w-11 rounded-xl bg-primary text-primary-content flex items-center justify-center">
							<Building2 className="w-5 h-5" />
						</span>
						<h3 className="font-display mt-5 text-2xl font-bold text-base-content">Portföy yönetimi</h3>
						<p className="mt-2 max-w-md text-[15px] text-base-content/70 leading-relaxed">
							Satılık ve kiralık taşınmazlarınız; tapu bilgileri, fotoğraflar ve
							harita üzerinde konumlarıyla tek yerde.
						</p>
					</div>
					{/* Standard cells */}
					{SMALL_FEATURES.slice(0, 1).map(({ icon: Icon, title, body }) => (
						<div key={title} className="reveal lg:col-span-2 rounded-2xl bg-base-100 border border-base-300/70 p-7 shadow-card">
							<Icon className="w-5 h-5 text-primary" />
							<h3 className="mt-4 text-lg font-bold text-base-content">{title}</h3>
							<p className="mt-2 text-sm text-base-content/70 leading-relaxed">{body}</p>
						</div>
					))}
					{SMALL_FEATURES.slice(1).map(({ icon: Icon, title, body }) => (
						<div key={title} className="reveal lg:col-span-2 rounded-2xl bg-base-100 border border-base-300/70 p-7 shadow-card">
							<Icon className="w-5 h-5 text-primary" />
							<h3 className="mt-4 text-lg font-bold text-base-content">{title}</h3>
							<p className="mt-2 text-sm text-base-content/70 leading-relaxed">{body}</p>
						</div>
					))}
					{/* Full-width closing cell: mobile — deliberate dark tile for contrast */}
					<div className="reveal sm:col-span-2 lg:col-span-6 rounded-2xl bg-neutral text-neutral-content p-7 sm:p-9 flex flex-col sm:flex-row sm:items-center gap-5">
						<span className="h-11 w-11 shrink-0 rounded-xl bg-neutral-content/10 flex items-center justify-center">
							<Smartphone className="w-5 h-5" />
						</span>
						<div>
							<h3 className="font-display text-xl font-bold">Telefonda kusursuz</h3>
							<p className="mt-1.5 max-w-2xl text-sm text-neutral-content/75 leading-relaxed">
								Sahada, tapuda, müşteri yanında — tüm özellikler mobil için tasarlandı.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* Pricing */}
			<section className="mx-auto max-w-4xl safe-x py-12" id="fiyatlar">
				<h2 className="reveal font-display text-3xl sm:text-4xl font-bold text-base-content">
					Basit, şeffaf fiyatlandırma
				</h2>
				<p className="reveal mt-2 text-base-content/60">
					Her plan 14 günlük ücretsiz deneme ile başlar — kredi kartı gerekmez.
				</p>
				<div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
					{PLANS.map((p) => (
						<div
							key={p.name}
							className={`reveal rounded-2xl bg-base-100 border p-6 sm:p-8 flex flex-col ${
								p.highlight ? "border-primary/60 shadow-card" : "border-base-300 shadow-soft"
							}`}
						>
							<div className="flex items-center justify-between">
								<h3 className="text-base font-bold text-base-content">{p.name}</h3>
								{p.highlight && (
									<span className="text-xs font-semibold text-primary bg-primary/10 rounded-md px-2 py-1">
										Önerilen
									</span>
								)}
							</div>
							<p className="font-display mt-4 text-5xl font-bold text-base-content">
								<span className="font-numeric">{p.price}</span>
								<span className="font-sans text-base font-normal text-base-content/50"> / ay</span>
							</p>
							<ul className="mt-5 mb-6 space-y-2.5 text-sm text-base-content/80">
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
								className={`mt-auto w-full h-11 inline-flex items-center justify-center rounded-xl text-sm font-semibold transition-[filter,background-color,transform] active:scale-[0.98] ${
									p.highlight
										? "bg-primary text-primary-content hover:brightness-110"
										: "border border-base-300 text-base-content hover:bg-base-200"
								}`}
							>
								Ücretsiz deneyin
							</Link>
						</div>
					))}
				</div>
			</section>

			{/* Bottom CTA: the one drenched block */}
			<section className="mx-auto max-w-6xl safe-x py-14">
				<div className="reveal rounded-3xl bg-primary text-primary-content px-6 py-12 sm:px-12 sm:py-16 shadow-pop">
					<h2 className="font-display text-3xl sm:text-4xl font-bold max-w-xl">
						Bugün deneyin, ekibinizi yarın davet edin
					</h2>
					<p className="mt-3 text-primary-content/85 max-w-md">
						14 gün ücretsiz — kart bilgisi istemiyoruz.
					</p>
					<Link
						href="/signup"
						className="mt-7 inline-flex px-8 h-12 items-center justify-center rounded-xl text-base font-semibold bg-base-100 text-base-content hover:bg-base-200 active:scale-[0.98] transition-[background-color,transform]"
					>
						Ücretsiz deneyin
					</Link>
				</div>
			</section>
		</PublicShell>
	);
}
