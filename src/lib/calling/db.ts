import { supabase } from "@/integrations/supabase/client";
import type { CallingCampaign, CallingQueueItem } from "./types";

// New tables are not in the generated Database types yet.
// Keep queries in one place so the rest of the UI stays typed.
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>;
};

export const callingTables = {
  campaigns: () => db.from("calling_campaigns"),
  queue: () => db.from("calling_queue"),
  calls: () => db.from("call_logs"),
  sms: () => db.from("sms_messages"),
  suppression: () => db.from("suppression_list"),
};

export type { CallingCampaign, CallingQueueItem };
