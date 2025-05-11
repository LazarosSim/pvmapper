
// Edge function to update the user_total_scans in profiles
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://ynslzmpfhmoghvcacwzd.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export const updateUserScans = async (userId: string) => {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    return { success: false, error: 'Missing service role key' };
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Count the user's barcodes
    const { count, error: countError } = await supabase
      .from('barcodes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (countError) {
      console.error('Error counting barcodes:', countError);
      return { success: false, error: countError };
    }
    
    // Update the user's profile with the total count
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ user_total_scans: count || 0 })
      .eq('id', userId);
      
    if (updateError) {
      console.error('Error updating profile:', updateError);
      return { success: false, error: updateError };
    }
    
    console.log(`User ${userId} total scans updated to ${count || 0}`);
    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Unexpected error:', error);
    return { success: false, error };
  }
};

// This is the edge function handler
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  if (req.method === 'POST') {
    try {
      const { userId } = await req.json();
      
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'User ID is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const result = await updateUserScans(userId);
      
      return new Response(
        JSON.stringify(result),
        { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(
        JSON.stringify({ error: 'Invalid request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
  
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
