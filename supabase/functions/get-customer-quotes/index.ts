import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user ID from request
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get customer projects for this user
    const { data: customerProjects, error: projectsError } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)

    if (projectsError) {
      throw projectsError
    }

    if (!customerProjects || customerProjects.length === 0) {
      return new Response(
        JSON.stringify({ data: [] }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const projectIds = customerProjects.map(p => p.id)

    // Fetch quotes with designer information
    const { data: quotes, error: quotesError } = await supabase
      .from('designer_quotes')
      .select(`
        *,
        designer:designers(id, name, email, phone, specialization, profile_image),
        project:customers!designer_quotes_project_id_fkey(id, project_name)
      `)
      .in('project_id', projectIds)
      .order('created_at', { ascending: false })

    if (quotesError) {
      throw quotesError
    }

    // For each quote, fetch its items
    const quotesWithItems = await Promise.all((quotes || []).map(async (quote) => {
      const { data: items, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id)
        
      if (itemsError) {
        console.error('Error fetching quote items:', itemsError)
        return { ...quote, items: [] }
      }
      
      return { ...quote, items: items || [] }
    }))

    return new Response(
      JSON.stringify({ data: quotesWithItems }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in get-customer-quotes function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})