import { cn } from "./cn";

const SIZES = {
	sm: "w-4 h-4 border-2",
	md: "w-6 h-6 border-2",
	lg: "w-8 h-8 border-[3px]",
} as const;

/** Shared loading spinner — replaces the hand-rolled border-spin divs. */
export function Spinner({
	size = "md",
	className,
	label = "Loading",
}: {
	size?: keyof typeof SIZES;
	className?: string;
	label?: string;
}) {
	return (
		<span
			role="status"
			aria-label={label}
			className={cn(
				"inline-block rounded-full border-primary/30 border-t-primary animate-spin",
				SIZES[size],
				className,
			)}
		/>
	);
}

/** Centered spinner block for section/page loading states. */
export function SpinnerBlock({ className }: { className?: string }) {
	return (
		<div className={cn("flex items-center justify-center py-12", className)}>
			<Spinner />
		</div>
	);
}
