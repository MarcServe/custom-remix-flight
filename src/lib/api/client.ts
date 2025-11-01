import { supabase } from '@/integrations/supabase/client';

/**
 * API client abstraction layer
 * This layer makes it easy to migrate to Next.js later by centralizing all API calls
 */

export const apiClient = {
  // Supabase client for direct database access
  supabase,

  // Call edge functions
  async callFunction<T = any>(
    functionName: string,
    body?: any
  ): Promise<{ data: T | null; error: Error | null }> {
    try {
      // Check for active session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('Session check:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        expiresAt: session?.expires_at 
      });

      if (!session) {
        console.error('No active session found');
        return { 
          data: null, 
          error: new Error('Your session has expired. Please sign in again.') 
        };
      }

      // Check if session is expired
      if (session.expires_at && session.expires_at * 1000 < Date.now()) {
        console.error('Session expired');
        return {
          data: null,
          error: new Error('Your session has expired. Please sign in again.')
        };
      }

      console.log(`Calling edge function: ${functionName}`);
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) {
        console.error(`Edge function ${functionName} error:`, error);
        return { data: null, error };
      }

      console.log(`Edge function ${functionName} success:`, data);
      return { data: data as T, error: null };
    } catch (error) {
      console.error(`Edge function ${functionName} exception:`, error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error('Unknown error'),
      };
    }
  },

  // Get current user
  async getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    return { user, error };
  },

  // Get current session
  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    return { session, error };
  },
};
