import { createClient } from "@/lib/supabase/server";

export interface CurrentAccount {
  userId: string;
  role: "supplier" | "buyer" | "admin" | "consumer";
  fullName: string;
  company: {
    id: string;
    name: string;
    country: string;
    verificationStatus: "pending" | "approved" | "rejected";
  } | null;
  verificationDocuments: {
    id: string;
    docType: string;
    status: "pending" | "approved" | "rejected";
    rejectionReason: string | null;
  }[];
}

// Единая точка чтения "кто я и что вижу" — используется статус-экраном
// онбординга (UX Bible §4.3) и заглушками дашбордов.
export async function getCurrentAccount(): Promise<CurrentAccount | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, role, full_name, company_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  let company: CurrentAccount["company"] = null;
  let verificationDocuments: CurrentAccount["verificationDocuments"] = [];

  if (profile.company_id) {
    const { data: companyRow } = await supabase
      .from("companies")
      .select("id, name, country, verification_status")
      .eq("id", profile.company_id)
      .single();
    if (companyRow) {
      company = {
        id: companyRow.id,
        name: companyRow.name,
        country: companyRow.country,
        verificationStatus: companyRow.verification_status ?? "pending",
      };
    }

    const { data: docs } = await supabase
      .from("verification_documents")
      .select("id, doc_type, status, rejection_reason")
      .eq("company_id", profile.company_id);
    verificationDocuments = (docs ?? []).map((d) => ({
      id: d.id,
      docType: d.doc_type,
      status: d.status ?? "pending",
      rejectionReason: d.rejection_reason,
    }));
  }

  return {
    userId: profile.id,
    role: profile.role,
    fullName: profile.full_name,
    company,
    verificationDocuments,
  };
}
