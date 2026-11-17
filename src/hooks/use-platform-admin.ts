import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** True when the signed-in user is a LeadBoosters platform admin (row in platform_admins). */
export function useIsPlatformAdmin(): boolean {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["platform-admin", user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("platform_admins").select("user_id").eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });
  return !!data;
}
