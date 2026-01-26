import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface TagGenerationRequest {
  companyId?: string;
  companyName: string;
  industry?: string;
  description?: string;
  products?: string[];
  website?: string;
  existingTags?: string[];
}

/**
 * Generate AI-powered tags based on company industry, description, and products
 * Returns relevant tags for campaign targeting and organization
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[generate-ai-tags] Starting tag generation');

  try {
    const { companyId, companyName, industry, description, products, website, existingTags = [] }: TagGenerationRequest = await req.json();

    if (!companyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for AI
    let context = `Company: ${companyName}\n`;
    if (industry) context += `Industry: ${industry}\n`;
    if (description) context += `Description: ${description}\n`;
    if (products && products.length > 0) {
      context += `Products/Services: ${products.join(', ')}\n`;
    }
    if (website) context += `Website: ${website}\n`;
    if (existingTags.length > 0) {
      context += `Existing Tags: ${existingTags.join(', ')}\n`;
    }

    // Generate tags using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a CRM tag generation specialist. Generate relevant, concise tags for companies based on their industry, products, and business characteristics.

Rules:
- Generate 5-10 relevant tags
- Include industry-specific tags (e.g., "SaaS", "FinTech", "E-commerce")
- Include business model tags (e.g., "B2B", "B2C", "Enterprise", "SMB")
- Include product/service category tags if applicable
- Include company size indicators if inferable (e.g., "Startup", "Scale-up", "Enterprise")
- Include technology stack tags if relevant (e.g., "AI/ML", "Cloud", "Mobile")
- Include market segment tags (e.g., "Healthcare", "Finance", "Education")
- Use concise, single-word or hyphenated tags (max 2 words)
- Avoid generic tags like "Company" or "Business"
- Return ONLY a JSON array of tag strings, nothing else
- Format: ["tag1", "tag2", "tag3"]
- Do NOT include existing tags unless they need to be modified`
          },
          {
            role: 'user',
            content: `Generate tags for this company:\n\n${context}\n\nReturn a JSON array of tags.`
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-ai-tags] OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Parse JSON array from response
    let tags: string[] = [];
    try {
      // Try to extract JSON array from response (might have markdown code blocks)
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try parsing the whole content
        tags = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('[generate-ai-tags] Failed to parse tags:', content);
      // Fallback: extract tags from text
      const lines = content.split('\n').filter(line => line.trim());
      tags = lines
        .map(line => line.replace(/^[-*•]\s*/, '').replace(/["']/g, '').trim())
        .filter(tag => tag.length > 0 && tag.length < 30)
        .slice(0, 10);
    }

    // Validate and clean tags
    tags = tags
      .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      .map(tag => tag.trim().replace(/[^\w\s-]/g, ''))
      .filter(tag => tag.length >= 2 && tag.length <= 30)
      .slice(0, 10); // Limit to 10 tags

    // Merge with existing tags (avoid duplicates, case-insensitive)
    const existingTagsLower = existingTags.map(t => t.toLowerCase());
    const newTags = tags.filter(tag => !existingTagsLower.includes(tag.toLowerCase()));
    const allTags = [...existingTags, ...newTags];

    // If companyId provided, update the company in database
    if (companyId) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { error: updateError } = await supabase
        .from('companies')
        .update({ tags: allTags })
        .eq('id', companyId);

      if (updateError) {
        console.error('[generate-ai-tags] Failed to update company tags:', updateError);
        // Don't fail the request, just log the error
      } else {
        console.log(`[generate-ai-tags] Updated company ${companyId} with ${allTags.length} tags`);
      }
    }

    console.log(`[generate-ai-tags] Generated ${tags.length} tags for ${companyName}:`, tags);

    return new Response(
      JSON.stringify({
        success: true,
        tags: allTags,
        newTags: tags,
        existingTags: existingTags,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[generate-ai-tags] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to generate tags',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
