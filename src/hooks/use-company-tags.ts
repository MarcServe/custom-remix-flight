import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TagPreset {
  id: string;
  name: string;
  category: string;
  color: string;
  created_at: string;
}

// Default tag suggestions organized by category
export const DEFAULT_TAG_SUGGESTIONS = {
  sector: ["B2B", "B2C", "Enterprise", "SMB", "Startup"],
  industry: ["SaaS", "FinTech", "HealthTech", "E-commerce", "MarTech", "EdTech", "AI/ML"],
  priority: ["Hot Lead", "VIP", "Follow-up", "Priority", "Nurture"],
  stage: ["Prospect", "Qualified", "In Progress", "Closed Won", "Closed Lost"],
  product: ["Product A", "Product B", "Upsell", "Cross-sell"],
  custom: [],
};

export function useCompanyTags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's tag presets
  const { data: tagPresets, isLoading: presetsLoading } = useQuery({
    queryKey: ["company-tag-presets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_tag_presets")
        .select("*")
        .eq("user_id", user?.id)
        .order("name");

      if (error) throw error;
      return data as TagPreset[];
    },
    enabled: !!user?.id,
  });

  // Fetch all unique tags used in companies (for suggestions)
  const { data: existingTags, isLoading: tagsLoading } = useQuery({
    queryKey: ["company-existing-tags", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("tags")
        .eq("user_id", user?.id)
        .not("tags", "is", null);

      if (error) throw error;

      // Flatten and dedupe all tags
      const allTags = new Set<string>();
      (data || []).forEach((company: { tags: string[] | null }) => {
        (company.tags || []).forEach((tag: string) => allTags.add(tag));
      });

      return Array.from(allTags).sort();
    },
    enabled: !!user?.id,
  });

  // Create a new tag preset
  const createPresetMutation = useMutation({
    mutationFn: async (preset: { name: string; category?: string; color?: string }) => {
      const { error } = await supabase.from("company_tag_presets").insert({
        user_id: user?.id,
        name: preset.name,
        category: preset.category || "custom",
        color: preset.color || "blue",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-tag-presets"] });
    },
  });

  // Delete a tag preset
  const deletePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      const { error } = await supabase
        .from("company_tag_presets")
        .delete()
        .eq("id", presetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-tag-presets"] });
    },
  });

  // Update company tags
  const updateCompanyTagsMutation = useMutation({
    mutationFn: async ({ companyId, tags }: { companyId: string; tags: string[] }) => {
      const { error } = await supabase
        .from("companies")
        .update({ tags })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies-full"] });
      queryClient.invalidateQueries({ queryKey: ["company-existing-tags"] });
    },
  });

  // Get all suggestions (presets + existing + defaults)
  const getAllSuggestions = (): string[] => {
    const suggestions = new Set<string>();

    // Add preset names
    (tagPresets || []).forEach((p) => suggestions.add(p.name));

    // Add existing tags from companies
    (existingTags || []).forEach((t) => suggestions.add(t));

    // Add default suggestions
    Object.values(DEFAULT_TAG_SUGGESTIONS)
      .flat()
      .forEach((t) => suggestions.add(t));

    return Array.from(suggestions).sort();
  };

  return {
    tagPresets,
    existingTags,
    allSuggestions: getAllSuggestions(),
    isLoading: presetsLoading || tagsLoading,
    createPreset: createPresetMutation.mutate,
    deletePreset: deletePresetMutation.mutate,
    updateCompanyTags: updateCompanyTagsMutation.mutate,
    isUpdating: updateCompanyTagsMutation.isPending,
  };
}
