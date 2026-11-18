import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

interface JobRequest { jobId: string }
interface ModelItem { room_name: string; name: string; description?: string; quantity: number; unit: string; width?: number; height?: number; depth?: number; confidence?: number; assumption?: string }
interface ModelRoom { name: string; width?: number; height?: number; unit?: string; confidence?: number; source_note?: string }
interface ModelResult { rooms: ModelRoom[]; items: ModelItem[]; assumptions: string[]; conflicts: string[] }

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const tokens = (value: string) => new Set(normalize(value).split(' ').filter(Boolean))
const matchMaterial = (name: string, materials: Array<{ id: string; name: string; unit: string; base_price: number; discount_price: number | null; is_discounted: boolean; description: string | null }>) => {
  const wanted = tokens(name)
  let best: (typeof materials)[number] | null = null
  let bestScore = 0
  for (const material of materials) {
    const candidate = tokens(material.name)
    const score = [...wanted].filter(token => candidate.has(token)).length / Math.max(wanted.size, candidate.size)
    if (score > bestScore) { bestScore = score; best = material }
  }
  return bestScore >= 0.5 ? best : null
}

async function refund(userClient: ReturnType<typeof createClient>, jobId: string) {
  await userClient.rpc('refund_ai_credit', { p_job_id: jobId, p_idempotency_key: `refund:${jobId}` })
}

function readProviderText(providerResult: { output_text?: unknown; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: unknown }> }> }) {
  if (typeof providerResult.output_text === 'string' && providerResult.output_text.trim()) return providerResult.output_text
  const parts: string[] = []
  for (const item of providerResult.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text)
    }
  }
  return parts.join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })

  let jobId = ''
  let userClient: ReturnType<typeof createClient> | null = null
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Authentication required' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const openAiKey = Deno.env.get('OPENAI_API_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'Service unavailable' }, 503)

    userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const adminClient = createClient(supabaseUrl, serviceKey)
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

    const body = await req.json() as JobRequest
    jobId = body.jobId
    if (!jobId) return json({ error: 'Quotation job is required' }, 400)

    const { data: job, error: jobError } = await adminClient
      .from('ai_quotation_jobs')
      .select('id, designer_id, source_file_path, source_file_type, requirements_text, status')
      .eq('id', jobId)
      .maybeSingle()
    if (jobError || !job) return json({ error: 'Quotation job not found' }, 404)

    const { data: designer } = await adminClient.from('designers').select('id, user_id').eq('id', job.designer_id).maybeSingle()
    if (!designer || designer.user_id !== userData.user.id) return json({ error: 'Quotation job access denied' }, 403)

    const updateStatus = async (status: string) => {
      await adminClient.from('ai_quotation_jobs').update({ status, error_code: null, error_message: null }).eq('id', jobId)
    }

    if (!openAiKey) throw new Error('PROVIDER_NOT_CONFIGURED')
    const { data: configuration } = await adminClient.from('ai_configuration').select('vision_model, text_model, routing_rules, is_enabled').eq('id', true).maybeSingle()
    if (!configuration?.is_enabled || !configuration.vision_model) throw new Error('PROVIDER_NOT_CONFIGURED')

    await updateStatus('analyzing_plan')
    const { data: signedFile, error: signedFileError } = await adminClient.storage.from('ai-floor-plans').createSignedUrl(job.source_file_path, 300)
    if (signedFileError || !signedFile?.signedUrl) throw new Error('FLOOR_PLAN_UNAVAILABLE')

    await updateStatus('understanding_requirements')
    const inputContent = job.source_file_type === 'application/pdf'
      ? [{ type: 'input_file', file_url: signedFile.signedUrl }, { type: 'input_text', text: job.requirements_text || 'Create a practical interior quotation from the visible plan.' }]
      : [{ type: 'input_image', image_url: signedFile.signedUrl, detail: 'high' }, { type: 'input_text', text: job.requirements_text || 'Create a practical interior quotation from the visible plan.' }]

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: configuration.vision_model,
        input: [{ role: 'user', content: inputContent }],
        temperature: 0.1,
        max_output_tokens: 5000,
        text: {
          format: {
            type: 'json_schema',
            name: 'ai_quotation_analysis',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                rooms: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, width: { type: ['number', 'null'] }, height: { type: ['number', 'null'] }, unit: { type: 'string' }, confidence: { type: 'number' }, source_note: { type: 'string' } }, required: ['name', 'width', 'height', 'unit', 'confidence', 'source_note'] } },
                items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { room_name: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, quantity: { type: 'number' }, unit: { type: 'string' }, width: { type: ['number', 'null'] }, height: { type: ['number', 'null'] }, depth: { type: ['number', 'null'] }, confidence: { type: 'number' }, assumption: { type: 'string' } }, required: ['room_name', 'name', 'description', 'quantity', 'unit', 'width', 'height', 'depth', 'confidence', 'assumption'] } },
                assumptions: { type: 'array', items: { type: 'string' } },
                conflicts: { type: 'array', items: { type: 'string' } },
              },
              required: ['rooms', 'items', 'assumptions', 'conflicts'],
            },
          },
        },
      }),
    })
    if (!openAiResponse.ok) {
      let providerError: { error?: { type?: string; message?: string } } = {}
      try { providerError = await openAiResponse.json() } catch { /* non-JSON body */ }
      const errorType = providerError.error?.type || ''
      const errorMessage = providerError.error?.message || ''
      if (openAiResponse.status === 401) throw new Error('PROVIDER_AUTH_FAILED')
      if (openAiResponse.status === 404) throw new Error('PROVIDER_MODEL_UNAVAILABLE')
      if (openAiResponse.status === 429) {
        if (errorType === 'insufficient_quota' || errorMessage.includes('no credits remaining') || errorMessage.includes('billing')) {
          throw new Error('PROVIDER_BILLING_EXHAUSTED')
        }
        throw new Error('PROVIDER_RATE_LIMITED')
      }
      throw new Error('PROVIDER_REQUEST_FAILED')
    }
    const providerResult = await openAiResponse.json()
    const outputText = readProviderText(providerResult)
    if (!outputText.trim()) throw new Error('INVALID_PROVIDER_RESULT')
    const result = JSON.parse(outputText) as ModelResult
    if (!Array.isArray(result.rooms) || !Array.isArray(result.items) || !Array.isArray(result.assumptions) || !Array.isArray(result.conflicts)) throw new Error('INVALID_PROVIDER_RESULT')

    await updateStatus('matching_catalogue')
    const { data: materials, error: materialsError } = await adminClient
      .from('designer_material_prices')
      .select('id, name, unit, base_price, discount_price, is_discounted, description')
      .eq('designer_id', job.designer_id)
      .eq('is_available', true)
    if (materialsError) throw new Error('CATALOGUE_UNAVAILABLE')

    await updateStatus('calculating')
    const roomIds = new Map<string, string>()
    for (const [index, room] of result.rooms.entries()) {
      const { data: insertedRoom, error: roomError } = await adminClient.from('ai_quotation_rooms').insert({
        job_id: jobId,
        name: room.name.trim().slice(0, 120),
        width: typeof room.width === 'number' && room.width > 0 ? room.width : null,
        height: typeof room.height === 'number' && room.height > 0 ? room.height : null,
        unit: room.unit || 'feet',
        confidence: Math.min(1, Math.max(0, room.confidence || 0)),
        source_note: room.source_note || null,
        display_order: index,
      }).select('id').maybeSingle()
      if (roomError || !insertedRoom) throw new Error('RESULT_SAVE_FAILED')
      roomIds.set(normalize(room.name), insertedRoom.id)
    }

    for (const item of result.items) {
      if (!item.name || !Number.isFinite(item.quantity) || item.quantity < 0) continue
      const material = matchMaterial(item.name, materials || [])
      const price = material ? (material.is_discounted && material.discount_price !== null ? material.discount_price : material.base_price) : 0
      const roomId = roomIds.get(normalize(item.room_name)) || null
      const { error: itemError } = await adminClient.from('ai_quotation_items').insert({
        job_id: jobId,
        room_id: roomId,
        material_id: material?.id || null,
        item_type: 'material',
        name: material?.name || item.name.trim().slice(0, 160),
        description: item.description || '',
        quantity: item.quantity,
        unit: material?.unit || item.unit || 'Nos',
        unit_price: price,
        number_of_units: 1,
        width: item.width && item.width > 0 ? item.width : null,
        height: item.height && item.height > 0 ? item.height : null,
        depth: item.depth && item.depth > 0 ? item.depth : null,
        confidence: Math.min(1, Math.max(0, item.confidence || 0)),
        assumption: material ? item.assumption || null : 'No matching designer catalogue rate found; add or select a rate before saving.',
      })
      if (itemError) throw new Error('RESULT_SAVE_FAILED')
    }

    await adminClient.from('ai_quotation_jobs').update({
      status: 'review_ready',
      assumptions: [...result.assumptions, ...result.conflicts.map(conflict => `Conflict: ${conflict}`)],
      provider_usage: providerResult.usage || {},
      model_config: { vision_model: configuration.vision_model, routing_rules: configuration.routing_rules || {} },
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)

    const { error: settlementError } = await userClient.rpc('settle_ai_credit', { p_job_id: jobId, p_idempotency_key: `consume:${jobId}` })
    if (settlementError) throw new Error('CREDIT_SETTLEMENT_FAILED')
    return json({ jobId, status: 'review_ready' })
  } catch (error) {
    console.error('ai quotation process failed', error)
    if (jobId && userClient) await refund(userClient, jobId)
    const code = error instanceof Error ? error.message : 'PROCESSING_FAILED'
    const userMessage =
      code === 'PROVIDER_NOT_CONFIGURED' ? 'AI provider is not configured yet. An admin must set the vision model and enable AI in settings.' :
      code === 'PROVIDER_AUTH_FAILED' ? 'The AI provider rejected the API key. An admin must update the OpenAI API key secret.' :
      code === 'PROVIDER_MODEL_UNAVAILABLE' ? 'The configured vision model is unavailable. An admin must set a valid model ID in settings.' :
      code === 'PROVIDER_BILLING_EXHAUSTED' ? 'The AI provider account has no billing credits remaining. An admin must add credits at platform.openai.com.' :
      code === 'PROVIDER_RATE_LIMITED' ? 'The AI provider is rate-limited right now. Please try again in a few minutes.' :
      'AI quotation could not be completed. Your credit was returned if it had been reserved.'
    if (jobId) {
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      if (serviceKey && supabaseUrl) {
        const adminClient = createClient(supabaseUrl, serviceKey)
        await adminClient.from('ai_quotation_jobs').update({ status: 'failed', error_code: code, error_message: userMessage }).eq('id', jobId)
      }
    }
    return json({ error: userMessage, code }, 422)
  }
})
