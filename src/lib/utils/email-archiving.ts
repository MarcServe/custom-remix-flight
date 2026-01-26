import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-archive emails older than specified days
 * This helps maintain clear separation between old and new emails
 */
export async function autoArchiveOldEmails(daysThreshold: number = 30) {
  try {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);
    const thresholdISO = thresholdDate.toISOString();

    // Archive old email activities
    const { error: activitiesError } = await supabase
      .from('email_activities')
      .update({ email_period: 'old' })
      .eq('email_period', 'new')
      .lt('sent_at', thresholdISO);

    if (activitiesError) {
      console.error('Error archiving email activities:', activitiesError);
      return { success: false, error: activitiesError };
    }

    // Archive old campaign recipients
    const { error: recipientsError } = await supabase
      .from('email_campaign_recipients')
      .update({ email_period: 'old' })
      .eq('email_period', 'new')
      .lt('sent_at', thresholdISO);

    if (recipientsError) {
      console.error('Error archiving campaign recipients:', recipientsError);
      return { success: false, error: recipientsError };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in auto-archive function:', error);
    return { success: false, error };
  }
}

/**
 * Manually archive specific emails
 */
export async function archiveEmails(emailIds: string[], type: 'activity' | 'campaign') {
  try {
    const table = type === 'activity' ? 'email_activities' : 'email_campaign_recipients';
    
    const { error } = await supabase
      .from(table)
      .update({ email_period: 'archived' })
      .in('id', emailIds);

    if (error) {
      console.error(`Error archiving ${type} emails:`, error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in archive function:', error);
    return { success: false, error };
  }
}

/**
 * Restore archived emails back to new
 */
export async function restoreArchivedEmails(emailIds: string[], type: 'activity' | 'campaign') {
  try {
    const table = type === 'activity' ? 'email_activities' : 'email_campaign_recipients';
    
    const { error } = await supabase
      .from(table)
      .update({ email_period: 'new' })
      .in('id', emailIds);

    if (error) {
      console.error(`Error restoring ${type} emails:`, error);
      return { success: false, error };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in restore function:', error);
    return { success: false, error };
  }
}
