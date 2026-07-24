// The privacy guarantee here is structural: tokens resolve from a named
// whitelist, so neither a property row nor a team-authored template can put the
// homeowner's name or tapu numbers into a client's chat. These tests pin that,
// pin the no-em-dash rule, and pin that adding a prefilled message did not
// change the URL every existing caller already relies on.

import { describe, expect, it } from "vitest";
import {
	renderPropertyMessage,
	propertyListMessage,
	propertyTokens,
	DEFAULT_PROPERTY_TEMPLATE,
	type ShareableProperty,
} from "./whatsappMessage";
import { whatsappUrl } from "./phone";

const prop = (over: Partial<ShareableProperty> = {}): ShareableProperty => ({
	address_line: "Kıbrıs Şehitleri Cd. 10",
	city: "İzmir",
	nitelik: "3+1",
	size_sqm: 120,
	bedrooms: 3,
	listing_type: "for_sale",
	list_price: 5_000_000,
	currency: "TRY",
	...over,
});

describe("renderPropertyMessage", () => {
	it("includes the address, type, facts and price", () => {
		const msg = renderPropertyMessage(prop());
		expect(msg).toContain("Kıbrıs Şehitleri Cd. 10");
		expect(msg).toContain("İzmir");
		expect(msg).toContain("Satılık");
		expect(msg).toContain("3+1");
		expect(msg).toContain("120 m²");
		expect(msg).toContain("5.000.000,00 TL");
	});

	it("labels a rental's price as monthly rent", () => {
		const msg = renderPropertyMessage(prop({ listing_type: "for_rent", list_price: 30_000 }));
		expect(msg).toContain("Kiralık");
		expect(msg).toContain("Aylık kira");
	});

	// Lines whose tokens are all empty are dropped, so no orphaned labels.
	it("drops lines whose tokens are all empty", () => {
		const msg = renderPropertyMessage(
			prop({ nitelik: null, size_sqm: null, bedrooms: null, list_price: null, city: null }),
		);
		expect(msg).toContain("Kıbrıs Şehitleri Cd. 10");
		expect(msg).not.toContain("Fiyat");
		expect(msg).not.toContain("m²");
		expect(msg).not.toContain("null");
		expect(msg).not.toContain("undefined");
		expect(msg).not.toContain("{");
	});

	it("omits the greeting when no client name is given", () => {
		expect(renderPropertyMessage(prop())).not.toContain("Merhaba");
		expect(renderPropertyMessage(prop(), { recipientName: "Ahmet Bey" })).toContain(
			"Merhaba Ahmet Bey,",
		);
	});

	it("signs with the sender when given", () => {
		expect(renderPropertyMessage(prop(), { senderName: "Kagu Emlak" })).toContain("Kagu Emlak");
	});

	it("never leaves three consecutive newlines from dropped lines", () => {
		const msg = renderPropertyMessage(prop({ list_price: null }));
		expect(msg).not.toMatch(/\n{3,}/);
	});

	// Em dashes read as machine-written and render inconsistently in chat.
	it("uses no em or en dashes in client-facing text", () => {
		const msg = renderPropertyMessage(prop(), {
			senderName: "Kagu Emlak",
			recipientName: "Ahmet Bey",
		});
		expect(msg).not.toMatch(/[—–]/);
		expect(DEFAULT_PROPERTY_TEMPLATE).not.toMatch(/[—–]/);
	});

	// The reason tokens are a whitelist rather than a formatter over the row.
	it("cannot leak homeowner or tapu data", () => {
		const hostile = {
			...prop(),
			homeowner_name: "Mehmet Yılmaz",
			ada_no: "1234",
			parsel_no: "56",
		} as ShareableProperty;
		const msg = renderPropertyMessage(hostile);
		expect(msg).not.toContain("Mehmet Yılmaz");
		expect(msg).not.toContain("1234");
	});

	// A team-authored template must not be able to reach past the whitelist.
	it("cannot leak via a hostile team template", () => {
		const hostile = { ...prop(), homeowner_name: "Mehmet Yılmaz" } as ShareableProperty;
		const msg = renderPropertyMessage(hostile, {}, "Sahibi: {homeowner_name} {ada_no}");
		expect(msg).not.toContain("Mehmet Yılmaz");
		// Unknown tokens stay literal so the mistake is visible to the author.
		expect(msg).toContain("{homeowner_name}");
	});

	it("honours a custom team template", () => {
		const msg = renderPropertyMessage(prop(), { senderName: "Kagu" }, "{adres} >> {fiyat} // {gonderen}");
		expect(msg).toBe("Kıbrıs Şehitleri Cd. 10, İzmir >> 5.000.000,00 TL // Kagu");
	});
});

describe("propertyTokens", () => {
	it("exposes only whitelisted keys", () => {
		const keys = Object.keys(propertyTokens(prop())).sort();
		expect(keys).toEqual(
			["ad", "adres", "fiyat", "fiyatEtiketi", "gonderen", "ozellikler", "tur"].sort(),
		);
	});
});

describe("propertyListMessage", () => {
	it("numbers each property and states the count", () => {
		const msg = propertyListMessage([prop(), prop({ address_line: "Alsancak Sk. 4" })]);
		expect(msg).toContain("2 taşınmaz");
		expect(msg).toContain("1. Kıbrıs Şehitleri Cd. 10");
		expect(msg).toContain("2. Alsancak Sk. 4");
	});

	it("cannot leak homeowner data and uses no em dashes", () => {
		const hostile = { ...prop(), homeowner_name: "Mehmet Yılmaz" } as ShareableProperty;
		const msg = propertyListMessage([hostile], { senderName: "Kagu Emlak" });
		expect(msg).not.toContain("Mehmet Yılmaz");
		expect(msg).not.toMatch(/[—–]/);
	});
});

describe("whatsappUrl with text", () => {
	// Every pre-existing caller passes no text; that output must not shift.
	it("is unchanged when no message is given", () => {
		expect(whatsappUrl("0532 111 22 33")).toBe("https://wa.me/905321112233");
		expect(whatsappUrl("0532 111 22 33", "")).toBe("https://wa.me/905321112233");
		expect(whatsappUrl("0532 111 22 33", "   ")).toBe("https://wa.me/905321112233");
		expect(whatsappUrl("0532 111 22 33", null)).toBe("https://wa.me/905321112233");
	});

	it("percent-encodes the message", () => {
		const url = whatsappUrl("05321112233", "Satılık 3+1\nFiyat: 5.000.000,00 TL");
		expect(url).toContain("?text=");
		// A raw "+" would decode as a space, and a raw newline is not URL-safe.
		expect(url).toContain("%2B");
		expect(url).toContain("%0A");
		expect(url).not.toContain("\n");
	});

	it("still rejects unusable phone numbers", () => {
		expect(whatsappUrl(null, "merhaba")).toBeNull();
		expect(whatsappUrl("123", "merhaba")).toBeNull();
	});
});
