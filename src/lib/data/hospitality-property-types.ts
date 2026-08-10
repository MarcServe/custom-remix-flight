/**
 * Property types and decision-maker roles for hospitality lead finding.
 * Sources are public business directories (e.g. Google Maps) and property websites —
 * not Airbnb marketplace host profiles.
 */

export type HospitalityPropertyType = {
  id: string;
  label: string;
  /** Google Maps / directory search phrase */
  searchQuery: string;
  /** Extra AI lead-finder search hints */
  aiHint: string;
};

export const HOSPITALITY_PROPERTY_TYPES: HospitalityPropertyType[] = [
  {
    id: "hotels",
    label: "Hotels",
    searchQuery: "hotels",
    aiHint: "hotels and hotel groups with general manager or sales contacts",
  },
  {
    id: "boutique-hotels",
    label: "Boutique hotels",
    searchQuery: "boutique hotels",
    aiHint: "boutique and independent hotels",
  },
  {
    id: "bed-and-breakfast",
    label: "B&Bs",
    searchQuery: "bed and breakfast",
    aiHint: "bed and breakfast inns and owners",
  },
  {
    id: "serviced-apartments",
    label: "Serviced apartments",
    searchQuery: "serviced apartments",
    aiHint: "serviced apartment operators and aparthotels",
  },
  {
    id: "guest-houses",
    label: "Guest houses",
    searchQuery: "guest house",
    aiHint: "guest houses and small lodging operators",
  },
  {
    id: "short-stay",
    label: "Short stay / holiday lets",
    searchQuery: "short stay accommodation holiday let",
    aiHint: "licensed short-stay and holiday let operators with public business listings",
  },
  {
    id: "hostels",
    label: "Hostels",
    searchQuery: "hostels",
    aiHint: "hostels and backpacker accommodation",
  },
  {
    id: "motels",
    label: "Motels",
    searchQuery: "motels",
    aiHint: "motels and roadside lodging",
  },
];

/** Roles we prioritize when enriching decision-maker contacts */
export const HOSPITALITY_DECISION_MAKER_ROLES = [
  "General Manager",
  "Owner",
  "Managing Director",
  "Revenue Manager",
  "Sales Director",
  "Front Office Manager",
  "Reservations Manager",
  "Marketing Manager",
  "Operations Manager",
] as const;

export const HOSPITALITY_CAMPAIGN_TAG = "Hospitality Leads";

export function buildHospitalityMapsQuery(selectedIds: string[]): string {
  const selected = HOSPITALITY_PROPERTY_TYPES.filter((t) => selectedIds.includes(t.id));
  if (selected.length === 0) return "hotels";
  if (selected.length === 1) return selected[0].searchQuery;
  return selected.map((t) => t.searchQuery).join(" OR ");
}

export function buildHospitalityAiSearchText(selectedIds: string[], location: string): string {
  const selected = HOSPITALITY_PROPERTY_TYPES.filter((t) => selectedIds.includes(t.id));
  const types =
    selected.length > 0
      ? selected.map((t) => t.aiHint).join("; ")
      : "hotels, short-stay accommodation, and lodging operators";
  const place = location.trim() || "major cities";
  return (
    `Find publicly listed lodging businesses in ${place}: ${types}. ` +
    `Prefer decision makers (${HOSPITALITY_DECISION_MAKER_ROLES.slice(0, 5).join(", ")}). ` +
    `Only include businesses with their own website or published business email/phone — not marketplace-only listings.`
  );
}
