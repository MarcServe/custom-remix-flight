import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) throw new Error('Unauthorized');

    const { companySequenceId, inboundThreadId, autoSend = false } = await req.json();

    if (!LOVABLE_API_KEY) {
      throw new Error('AI is not configured. Please enable Lovable AI.');
    }

    console.log('Generating AI response for sequence:', companySequenceId);

    // Get company sequence with all context
    const { data: companySeq, error: seqError } = await supabaseClient
      .from('company_sequences')
      .select(`
        *,
        email_sequences(goal, ai_instructions, custom_instructions, tone_preference),
        companies(name, industry, description, website)
      `)
      .eq('id', companySequenceId)
      .single();

    if (seqError) throw seqError;

    // Get user profile and business profile
    const { data: userProfile } = await supabaseClient
      .from('profiles')
      .select('full_name, job_title')
      .eq('id', user.id)
      .single();

    const { data: businessProfile } = await supabaseClient
      .from('business_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!businessProfile) {
      throw new Error('Please complete your business profile first');
    }

    // Get conversation history (email threads)
    const { data: threads } = await supabaseClient
      .from('email_threads')
      .select('*')
      .eq('company_sequence_id', companySequenceId)
      .order('received_at', { ascending: true });

    // Get the inbound email we're responding to
    const { data: inboundThread } = await supabaseClient
      .from('email_threads')
      .select('*')
      .eq('id', inboundThreadId)
      .single();

    if (!inboundThread) throw new Error('Inbound email not found');

    // Build conversation history for AI
    const conversationHistory = (threads || []).map(t => ({
      direction: t.direction,
      from: t.from_email,
      to: t.to_email,
      subject: t.subject,
      body: t.body_text,
      timestamp: t.received_at,
      sentiment: t.sentiment,
    }));

    // Build comprehensive AI prompt
    const prompt = `You are ${userProfile?.full_name || 'a sales representative'}, ${userProfile?.job_title || 'Sales'} at ${businessProfile.company_name}.

YOUR COMPANY:
- Name: ${businessProfile.company_name}
- Industry: ${businessProfile.industry}
- Services: ${businessProfile.services_description}
${businessProfile.value_proposition ? `- Value Proposition: ${businessProfile.value_proposition}` : ''}

SEQUENCE GOAL: ${companySeq.email_sequences.goal || 'Engage with prospect'}

PROSPECT COMPANY:
- Name: ${companySeq.companies.name}
- Industry: ${companySeq.companies.industry || 'Unknown'}
${companySeq.companies.description ? `- About: ${companySeq.companies.description}` : ''}

CONVERSATION HISTORY:
${conversationHistory.map(m => `[${m.direction.toUpperCase()}] From: ${m.from}
Subject: ${m.subject}
${m.body}
${m.sentiment ? `Sentiment: ${m.sentiment}` : ''}
---`).join('\n\n')}

LATEST EMAIL FROM PROSPECT:
From: ${inboundThread.from_email}
Subject: ${inboundThread.subject}
${inboundThread.body_text}

${inboundThread.ai_analysis ? `
AI Analysis:
- Sentiment: ${inboundThread.ai_analysis.sentiment}
- Key Points: ${inboundThread.ai_analysis.keyPoints?.join(', ')}
- Questions: ${inboundThread.ai_analysis.questionsAsked?.join(', ')}
- Intent: ${inboundThread.ai_analysis.intent}
` : ''}

${companySeq.email_sequences.ai_instructions ? `CUSTOM INSTRUCTIONS: ${companySeq.email_sequences.ai_instructions}` : ''}

TASK:
Write a personalized response email that:
1. Addresses their questions/concerns directly
2. Provides helpful information
3. Moves toward the sequence goal: ${companySeq.email_sequences.goal}
4. Uses ${businessProfile.tone_preference || 'professional'} tone
5. Is concise (150-200 words maximum)
6. Includes a clear call-to-action
7. Ends with proper signature:

Best regards,
${userProfile?.full_name || 'Sales Team'}
${userProfile?.job_title || 'Sales'}
${businessProfile.company_name}

Return ONLY a JSON object with this structure:
{
  "subject": "Re: [their subject] or personalized subject",
  "body": "complete email body with signature"
}`;

    console.log('Calling AI to generate response...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert B2B sales email writer. Create personalized, context-aware responses that build relationships and drive engagement.' 
          },
          { role: 'user', content: prompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'generate_email_response',
            description: 'Generate a personalized email response',
            parameters: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                body: { type: 'string' }
              },
              required: ['subject', 'body']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'generate_email_response' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', errorText);
      throw new Error('Failed to generate email with AI');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('AI did not return valid response');
    }

    const emailContent = JSON.parse(toolCall.function.arguments);

    console.log('AI generated response:', emailContent);

    // Store as draft or send automatically
    const responseStatus = autoSend ? 'ready_to_send' : 'draft';

    // Update company sequence with generated response
    await supabaseClient
      .from('company_sequences')
      .update({
        metadata: {
          ...companySeq.metadata,
          ai_generated_response: emailContent,
          response_status: responseStatus,
          generated_at: new Date().toISOString(),
        },
      })
      .eq('id', companySequenceId);

    return new Response(
      JSON.stringify({
        success: true,
        subject: emailContent.subject,
        body: emailContent.body,
        status: responseStatus,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error generating AI response:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});