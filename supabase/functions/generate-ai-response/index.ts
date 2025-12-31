import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// Map Gemini models to OpenAI equivalents
function mapModelToOpenAI(model: string): string {
  const modelMap: Record<string, string> = {
    'google/gemini-2.5-flash': 'gpt-4o-mini',
    'google/gemini-2.5-flash-lite': 'gpt-4o-mini',
    'google/gemini-2.5-pro': 'gpt-4o',
  };
  return modelMap[model] || model;
}

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

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured. Please add it in Supabase Edge Function Secrets.');
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
      .select('*, ai_model, ai_temperature, ai_max_tokens, ai_response_style')
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
4. Uses ${businessProfile.ai_response_style || businessProfile.tone_preference || 'professional'} tone
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

    console.log('Calling OpenAI to generate response...');
    const startTime = Date.now();

    // Map model to OpenAI
    const requestedModel = businessProfile.ai_model || 'google/gemini-2.5-flash';
    const model = mapModelToOpenAI(requestedModel);
    console.log(`Using model: ${model} (mapped from ${requestedModel})`);

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert B2B sales email writer. Create personalized, context-aware responses that build relationships and drive engagement.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: businessProfile.ai_temperature || 0.7,
        max_tokens: businessProfile.ai_max_tokens || 500,
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
      console.error('OpenAI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (aiResponse.status === 401 || aiResponse.status === 402) {
        throw new Error('OpenAI API key invalid or billing issue.');
      }
      
      throw new Error('Failed to generate email with AI');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('AI did not return valid response');
    }

    const emailContent = JSON.parse(toolCall.function.arguments);
    const responseTime = Date.now() - startTime;

    console.log('AI generated response:', emailContent);

    // Track analytics
    const tokenCount = (emailContent.subject + emailContent.body).length;
    await supabaseClient
      .from('auto_response_analytics')
      .insert({
        user_id: user.id,
        company_sequence_id: companySequenceId,
        ai_model: model,
        ai_temperature: businessProfile.ai_temperature || 0.7,
        response_time_ms: responseTime,
        token_count: tokenCount,
        metadata: {
          sequence_goal: companySeq.email_sequences.goal,
          company_name: companySeq.companies.name,
          tone: businessProfile.ai_response_style || businessProfile.tone_preference,
        },
      });

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

    console.log(`AI response saved as ${responseStatus}`);

    // If autoSend is true, immediately send the response
    if (autoSend) {
      console.log('Auto-send enabled, sending AI response...');
      
      try {
        const { error: sendError } = await supabaseClient.functions.invoke('send-ai-response', {
          body: {
            companySequenceId,
            subject: emailContent.subject,
            body: emailContent.body,
            inboundThreadId,
          },
        });

        if (sendError) {
          console.error('Failed to auto-send AI response:', sendError);
          return new Response(
            JSON.stringify({
              success: false,
              error: `AI response generated but failed to send: ${sendError.message}`,
              subject: emailContent.subject,
              body: emailContent.body,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log('AI response auto-sent successfully');
        
        return new Response(
          JSON.stringify({
            success: true,
            subject: emailContent.subject,
            body: emailContent.body,
            status: 'sent',
            autoSent: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } catch (sendError) {
        console.error('Error auto-sending AI response:', sendError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subject: emailContent.subject,
        body: emailContent.body,
        status: responseStatus,
        autoSent: false,
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
