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
      let responseData: any = null;
      let responseError: any = null;
      
      try {
        const { data, error } = await supabase.functions.invoke(functionName, {
          body,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        
        responseData = data;
        responseError = error;
      } catch (invokeError: any) {
        console.error(`Edge function ${functionName} invoke exception:`, invokeError);
        responseError = invokeError;
      }

      if (responseError) {
        console.error(`Edge function ${functionName} error:`, responseError);
        console.error(`Error type:`, typeof responseError);
        console.error(`Error keys:`, Object.keys(responseError || {}));
        console.error(`Error context:`, responseError?.context);
        
        // Try to extract error message from response
        let errorMessage = responseError?.message || 'Unknown error';
        
        // Check if error has a response body we can parse
        // FunctionsHttpError has context as the Response object
        if (responseError?.context) {
          try {
            // The context might be a Response object (for FunctionsHttpError)
            const response = responseError.context;
            
            // If it's a Response object, read the body
            if (response instanceof Response || (response && typeof response.json === 'function')) {
              try {
                const errorBody = await response.json();
                console.log('Parsed error body from Response:', errorBody);
                
                if (errorBody && typeof errorBody === 'object') {
                  if (errorBody.error) {
                    errorMessage = errorBody.error;
                    if (errorBody.details) {
                      errorMessage += `: ${errorBody.details}`;
                    }
                  } else if (errorBody.message) {
                    errorMessage = errorBody.message;
                  }
                }
              } catch (jsonError) {
                // If JSON parsing fails, try text
                try {
                  const errorText = await response.text();
                  console.log('Error response text:', errorText);
                  // Try to parse as JSON
                  const errorBody = JSON.parse(errorText);
                  if (errorBody.error) {
                    errorMessage = errorBody.error;
                    if (errorBody.details) {
                      errorMessage += `: ${errorBody.details}`;
                    }
                  }
                } catch (textError) {
                  console.error('Failed to read error response:', textError);
                }
              }
            } else if (response && typeof response === 'object') {
              // Context might be a plain object with response data
              const responseBody = response.data || response.body || response.response?.data;
              
              if (responseBody) {
                const errorBody = typeof responseBody === 'string' 
                  ? JSON.parse(responseBody) 
                  : responseBody;
                
                if (errorBody && typeof errorBody === 'object') {
                  if (errorBody.error) {
                    errorMessage = errorBody.error;
                    if (errorBody.details) {
                      errorMessage += `: ${errorBody.details}`;
                    }
                  } else if (errorBody.message) {
                    errorMessage = errorBody.message;
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to parse error response:', e);
          }
        }
        
        // Also check if data exists but indicates an error
        if (responseData && typeof responseData === 'object' && 'error' in responseData) {
          errorMessage = responseData.error;
          if (responseData.details) {
            errorMessage += `: ${responseData.details}`;
          }
        }
        
        return { 
          data: responseData || null, 
          error: new Error(errorMessage) 
        };
      }

      console.log(`Edge function ${functionName} success:`, responseData);
      return { data: responseData as T, error: null };
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
