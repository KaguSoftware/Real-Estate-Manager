// Atomic record creation for the document wizard (migration 0019). One RPC
// per document kind: tenant → (guarantor) → lease/sale → property status all
// commit or roll back together, so a mid-sequence failure can't leave
// orphaned rows. RLS still applies (functions are SECURITY INVOKER).

import { requireTeamId } from "./teams";
import { requireUser } from "./requireUser";


export interface PartyInput {
	full_name: string;
	email?: string | null;
	phone?: string | null;
	national_id?: string | null;
}

export interface RentalRecordsInput {
	property_id: string;
	tenant: PartyInput;
	guarantor: PartyInput | null;
	lease: {
		term: "1yr" | "2yr" | "undefined";
		start_date: string;
		end_date: string | null;
		monthly_rent: number;
		deposit: number;
		currency: string;
		payment_day: number | null;
		payment_method: string | null;
		bank_account: string | null;
		util_electricity: string;
		util_water: string;
		util_gas: string;
		util_internet: string;
		util_aidat: string;
		subletting_allowed: boolean;
		rent_increase_note: string | null;
		inventory: unknown[];
		condition_notes: string | null;
		special_conditions: string | null;
	};
}

export interface SalesRecordsInput {
	property_id: string;
	buyer: PartyInput;
	sale: {
		sale_price: number;
		currency: string;
		sale_date: string;
		target_close_date: string | null;
		deposit_amount: number | null;
		penalty_amount: number | null;
		validity_days: number | null;
		tax_responsibility: "buyer" | "seller" | "legal";
		buyer_commission_rate: number | null;
		seller_commission_rate: number | null;
		special_conditions: string | null;
	};
}

export async function createRentalRecords(
	input: RentalRecordsInput,
): Promise<{ tenant_id: string; guarantor_id: string | null; lease_id: string }> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase.rpc("create_rental_records", {
		p_team_id: requireTeamId(),
		p_property_id: input.property_id,
		p_tenant: input.tenant,
		p_guarantor: input.guarantor,
		p_lease: input.lease,
	});
	if (error) throw error;
	return data as { tenant_id: string; guarantor_id: string | null; lease_id: string };
}

export async function createSalesRecords(
	input: SalesRecordsInput,
): Promise<{ buyer_id: string; sale_id: string }> {
	const { supabase } = await requireUser();
	const { data, error } = await supabase.rpc("create_sales_records", {
		p_team_id: requireTeamId(),
		p_property_id: input.property_id,
		p_buyer: input.buyer,
		p_sale: input.sale,
	});
	if (error) throw error;
	return data as { buyer_id: string; sale_id: string };
}
