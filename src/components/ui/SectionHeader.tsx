"use client";
import { LucideIcon } from "lucide-react";

export const SectionHeader = ({
	title,
	icon: Icon,
}: {
	title: string;
	icon: LucideIcon;
}) => {
	return (
		<div className="flex items-center gap-2.5 mb-6 border-b border-base-300 pb-4">
			<Icon size={18} strokeWidth={2} className="text-base-content/40" aria-hidden />
			<h2 className="font-display text-lg font-bold text-base-content">
				{title}
			</h2>
		</div>
	);
};
