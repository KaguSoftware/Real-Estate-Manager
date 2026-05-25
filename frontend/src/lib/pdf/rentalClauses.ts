// Standard rental-agreement clauses.
// Use {placeholder} tokens; interpolate() in sections/rental.tsx resolves them
// against the lease values at render time. Editing this file is the single
// source of truth for the boilerplate legal copy.

export const RENTAL_STANDARD_CLAUSES = [
	"Rent of {monthly_rent} {currency} is due on the 1st of each calendar month. Payments more than 5 days late incur a 5% late fee.",
	"A security deposit of {deposit} {currency} is held by the Landlord for the duration of the tenancy and refunded within 30 days of move-out, less any deductions for damage beyond normal wear.",
	"The Tenant shall use the property solely as a private residence and shall not sublet or assign without the Landlord's written consent.",
	"The Tenant is responsible for utilities (electricity, water, gas, internet) unless otherwise agreed in writing.",
	"The Landlord is responsible for structural repairs and major appliance failures not caused by Tenant negligence. The Tenant shall report any required repairs in writing within a reasonable time.",
	"The Tenant shall keep the property in a clean and sanitary condition and shall not make alterations without the Landlord's written consent.",
	"Either party may terminate this agreement with 30 days' written notice in the case of an undefined-term tenancy. Fixed-term leases may only be terminated early by mutual written agreement or for cause permitted by local law.",
	"This agreement shall be governed by the laws of the jurisdiction in which the property is located. Any disputes shall be resolved in the local courts of that jurisdiction.",
];

export function interpolate(template: string, vars: Record<string, string | number>): string {
	return template.replace(/\{(\w+)\}/g, (_m, key) => {
		const v = vars[key];
		return v === undefined || v === null ? `{${key}}` : String(v);
	});
}
