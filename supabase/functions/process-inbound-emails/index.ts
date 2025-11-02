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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      from, 
      to, 
      subject, 
      bodyHtml, 
      bodyText, 
      messageId, 
      threadId,
      inReplyTo 
    } = await req.json();

    console.log('Processing inbound email:', { from, to, subject, messageId });

    // Find the company sequence by matching sender email, thread ID, or In-Reply-To header
    // Step 1: Try matching via In-Reply-To or thread_id (most reliable)
    let matchedSequence = null;
    let matchedActivity = null;

    if (inReplyTo || threadId) {
      console.log('Attempting to match by In-Reply-To or thread_id:', { inReplyTo, threadId });
      
      const { data: activities } = await supabaseClient
        .from('email_activities')
        .select('*, company_sequences(*)')
        .or(`external_message_id.eq.${inReplyTo},thread_id.eq.${threadId}`)
        .limit(1);

      if (activities && activities.length > 0) {
        console.log('Matched email via In-Reply-To/thread_id');
        matchedActivity = activities[0];
        matchedSequence = matchedActivity.company_sequences;
      }
    }

    // Step 2: Fallback - Match by sender email
    if (!matchedSequence) {
      console.log('Fallback: matching by sender email from:', from);
      
      const { data: sequences, error: seqError } = await supabaseClient
        .from('company_sequences')
        .select(`
          *,
          email_sequences(goal, ai_instructions, created_by),
          companies(name, industry, description),
          email_activities(id, external_message_id, thread_id, metadata)
        `)
        .eq('status', 'active')
        .not('next_action', 'eq', 'completed');

      if (seqError) throw seqError;

      // Match by checking email_activities metadata for matching to_email
      for (const seq of sequences || []) {
        const activities = seq.email_activities || [];
        const matching = activities.find((act: any) => 
          act.metadata?.to_email === from || 
          act.metadata?.recipient_email === from
        );
        
        if (matching) {
          matchedSequence = seq;
          matchedActivity = matching;
          console.log('Matched via email address in activities');
          break;
        }
      }
    }

    if (!matchedSequence) {
      console.log('No matching sequence found for email from:', from);
      return new Response(
        JSON.stringify({ message: 'No matching sequence found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Matched sequence:', matchedSequence.id);

    // Analyze email with AI
    let sentiment = 'neutral';
    let aiAnalysis = {};

    if (LOVABLE_API_KEY) {
      try {
        const analysisPrompt = `Analyze this email response and provide:
1. Sentiment: positive, negative, neutral, interested, not_interested, or requesting_info
2. Key points mentioned
3. Questions asked
4. Intent (what does the sender want?)

Email:
From: ${from}
Subject: ${subject}
Body: ${bodyText}

Return a JSON object with: sentiment, keyPoints (array), questionsAsked (array), intent (string)`;

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
                content: 'You are an email analysis expert. Analyze emails and extract structured insights.' 
              },
              { role: 'user', content: analysisPrompt }
            ],
            tools: [{
              type: 'function',
              function: {
                name: 'analyze_email',
                description: 'Analyze email and return structured insights',
                parameters: {
                  type: 'object',
                  properties: {
                    sentiment: { 
                      type: 'string', 
                      enum: ['positive', 'negative', 'neutral', 'interested', 'not_interested', 'requesting_info'] 
                    },
                    keyPoints: { type: 'array', items: { type: 'string' } },
                    questionsAsked: { type: 'array', items: { type: 'string' } },
                    intent: { type: 'string' }
                  },
                  required: ['sentiment', 'keyPoints', 'questionsAsked', 'intent']
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'analyze_email' } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            aiAnalysis = JSON.parse(toolCall.function.arguments);
            sentiment = (aiAnalysis as any).sentiment || 'neutral';
            console.log('AI Analysis:', aiAnalysis);
          }
        }
      } catch (error) {
        console.error('AI analysis error:', error);
      }
    }

    // Store the inbound email in email_threads
    // Use matched thread_id if available for proper threading
    const useThreadId = matchedActivity?.thread_id || threadId;
    
    const { data: thread, error: threadError } = await supabaseClient
      .from('email_threads')
      .insert({
        company_sequence_id: matchedSequence.id,
        message_id: messageId,
        thread_id: useThreadId,
        direction: 'inbound',
        subject,
        body_html: bodyHtml,
        body_text: bodyText,
        from_email: from,
        to_email: to,
        sentiment,
        ai_analysis: aiAnalysis,
      })
      .select()
      .single();

    if (threadError) throw threadError;

    // Update email_activities with replied_at timestamp if we matched an activity
    if (matchedActivity) {
      console.log('Updating email activity with reply timestamp');
      await supabaseClient
        .from('email_activities')
        .update({ 
          replied_at: new Date().toISOString(),
          status: 'replied'
        })
        .eq('id', matchedActivity.id);
    }

    // Update conversation history
    const conversationHistory = matchedSequence.conversation_history || [];
    conversationHistory.push({
      direction: 'inbound',
      from,
      subject,
      body: bodyText,
      timestamp: new Date().toISOString(),
      sentiment,
    });

    // Determine next action based on sentiment and AI analysis
    let nextAction = 'wait_for_response';
    if (sentiment === 'interested' || sentiment === 'requesting_info') {
      nextAction = 'personalized_response';
    } else if (sentiment === 'not_interested') {
      nextAction = 'paused';
    }

    // Update company sequence
    await supabaseClient
      .from('company_sequences')
      .update({
        conversation_history: conversationHistory,
        ai_context: {
          ...matchedSequence.ai_context,
          last_response_sentiment: sentiment,
          last_response_at: new Date().toISOString(),
          ai_analysis: aiAnalysis,
        },
        next_action: nextAction,
      })
      .eq('id', matchedSequence.id);

    // If AI response is needed, trigger generation
    if (nextAction === 'personalized_response') {
      console.log('Triggering AI response generation');
      
      // Check if auto-response is enabled for this sequence
      const autoSend = matchedSequence.auto_respond_enabled === true;
      console.log(`Auto-response enabled: ${autoSend}`);
      
      // Call generate-ai-response function with autoSend flag
      const { error: generateError } = await supabaseClient.functions.invoke('generate-ai-response', {
        body: { 
          companySequenceId: matchedSequence.id,
          inboundThreadId: thread.id,
          autoSend 
        },
      });

      if (generateError) {
        console.error('Error triggering AI response:', generateError);
      } else {
        console.log(`AI response generation triggered (autoSend: ${autoSend})`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email processed',
        sequenceId: matchedSequence.id,
        threadId: thread.id,
        sentiment,
        nextAction,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Error processing inbound email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});