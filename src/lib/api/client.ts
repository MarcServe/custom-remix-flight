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
      // Get session and include Authorization header for edge functions
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found');
        return { 
          data: null, 
          error: new Error('Your session has expired. Please sign in again.') 
        };
      }

      console.log(`Calling edge function: ${functionName} with auth`);
      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
