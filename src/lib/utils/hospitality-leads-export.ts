/**
 * CSV export for hospitality outreach campaigns (email + phone focused).
 */

export interface HospitalityLeadExportRow {
  propertyName: string;
  propertyType?: string;
  website?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  emailVerified?: boolean;
  emailSource?: string;
  contactName?: string;
  contactTitle?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactEmailVerified?: boolean;
  rating?: number;
  reviews?: number;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateHospitalityLeadsCSV(rows: HospitalityLeadExportRow[]): string {
  const headers = [
    "Property Name",
    "Property Type",
    "Website",
    "Address",
    "City",
    "Property Phone",
    "Property Email",
    "Property Email Verified",
    "Email Source",
    "Decision Maker Name",
    "Decision Maker Title",
    "Decision Maker Phone",
    "Decision Maker Email",
    "Decision Maker Email Verified",
    "Google Rating",
    "Google Reviews",
  ];

  const lines = rows.map((r) =>
    [
      escapeCSV(r.propertyName || ""),
      escapeCSV(r.propertyType || ""),
      escapeCSV(r.website || ""),
      escapeCSV(r.address || ""),
      escapeCSV(r.city || ""),
      escapeCSV(r.phone || ""),
      escapeCSV(r.email || ""),
      r.emailVerified ? "yes" : "no",
      escapeCSV(r.emailSource || ""),
      escapeCSV(r.contactName || ""),
      escapeCSV(r.contactTitle || ""),
      escapeCSV(r.contactPhone || ""),
      escapeCSV(r.contactEmail || ""),
      r.contactEmailVerified ? "yes" : "no",
      r.rating?.toString() || "",
      r.reviews?.toString() || "",
    ].join(",")
  );

  return [headers.join(","), ...lines].join("\n");
}

export function downloadHospitalityLeadsCSV(
  rows: HospitalityLeadExportRow[],
  filename = `hospitality-leads-${new Date().toISOString().slice(0, 10)}.csv`
): void {
  const csv = generateHospitalityLeadsCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
