"use client";

import dynamic from "next/dynamic";
import { useAppStore } from "@/src/store";

const PropertyMapInner = dynamic(
	() => import("./PropertyMapInner").then((m) => m.PropertyMapInner),
	{
		ssr: false,
		loading: () => (
			<div className="h-80 w-full rounded-2xl bg-slate-100 animate-pulse" />
		),
	},
);

export function PropertyMap() {
	const properties = useAppStore((s) => s.properties);
	const mappable = properties.filter((p) => p.latitude != null && p.longitude != null);

	return (
		<section className="mb-4 bg-white rounded-2xl border border-slate-200 overflow-hidden">
			{mappable.length === 0 ? (
				<div className="h-80 w-full flex items-center justify-center text-center px-6">
					<div>
						<p className="text-sm font-semibold text-slate-700">No mapped properties yet</p>
						<p className="text-xs text-slate-500 mt-1">
							Addresses are geocoded on save. Create or edit a property to see it on the map.
						</p>
					</div>
				</div>
			) : (
				<PropertyMapInner properties={mappable} />
			)}
		</section>
	);
}
