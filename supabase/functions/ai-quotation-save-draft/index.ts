import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
interface DraftItem { roomName: string; materialId?: string | null; itemType: 'material' | 'labor' | 'service' | 'other' | 'component'; name: string; description?: string; quantity: number; unit: string; numberOfUnits?: number; unitPrice: number; discountPercent?: number; width?: number; height?: number; depth?: number }
interface SaveRequest { jobId: string; title: string; quoteNumber?: string; description?: string; notes?: string; status: 'draft' | 'sent'; taxRate: number; discountAmount: number; items: DraftItem[] }
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!token || !url || !anonKey || !serviceKey) return json({ error: 'Authentication required' }, 401)
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } })
    const adminClient = createClient(url, serviceKey)
    const { data: userData } = await userClient.auth.getUser(token)
    if (!userData.user) return json({ error: 'Authentication required' }, 401)
    const body = await req.json() as SaveRequest
    if (!body.jobId || !body.title?.trim() || !['draft', 'sent'].includes(body.status) || !Array.isArray(body.items) || body.items.length === 0) return json({ error: 'Complete quotation details are required' }, 400)
    if (!Number.isFinite(body.taxRate) || body.taxRate < 0 || body.taxRate > 100 || !Number.isFinite(body.discountAmount) || body.discountAmount < 0) return json({ error: 'Invalid quotation totals' }, 400)

    const { data: job } = await adminClient.from('ai_quotation_jobs').select('id, designer_id, project_id, status').eq('id', body.jobId).maybeSingle()
    if (!job || job.status !== 'review_ready') return json({ error: 'Quotation is not ready for review' }, 409)
    const { data: designer } = await adminClient.from('designers').select('id, user_id').eq('id', job.designer_id).maybeSingle()
    if (!designer || designer.user_id !== userData.user.id) return json({ error: 'Quotation access denied' }, 403)
    const { data: customer } = await adminClient.from('customers').select('id, assigned_designer_id').eq('id', job.project_id).maybeSingle()
    if (!customer || customer.assigned_designer_id !== designer.id) return json({ error: 'Project access denied' }, 403)

    const materialIds = body.items.map(item => item.materialId).filter((id): id is string => Boolean(id))
    const { data: materials } = materialIds.length ? await adminClient.from('designer_material_prices').select('id, name, unit, base_price, discount_price, is_discounted').eq('designer_id', designer.id).in('id', materialIds).eq('is_available', true) : { data: [] }
    const materialMap = new Map((materials || []).map(material => [material.id, material]))
    const normalizedItems = body.items.map(item => {
      if (!item.name?.trim() || !Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || !Number.isFinite(item.numberOfUnits ?? 1) || (item.numberOfUnits ?? 1) <= 0) throw new Error('INVALID_ITEM')
      const material = item.materialId ? materialMap.get(item.materialId) : null
      if (item.materialId && !material) throw new Error('INVALID_MATERIAL')
      const unitPrice = material ? (material.is_discounted && material.discount_price !== null ? material.discount_price : material.base_price) : item.unitPrice
      const discount = item.discountPercent ?? 0
      if (discount < 0 || discount > 100) throw new Error('INVALID_ITEM')
      const amount = (item.numberOfUnits ?? 1) * item.quantity * unitPrice * (1 - discount / 100)
      return { ...item, material, unitPrice, discount, amount }
    })
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0)
    const taxable = Math.max(0, subtotal - body.discountAmount)
    const taxAmount = taxable * (body.taxRate / 100)
    const totalAmount = taxable + taxAmount
    const quoteNumber = /^QT-\d{4,12}$/.test(body.quoteNumber || '') ? body.quoteNumber as string : `QT-${Date.now().toString().slice(-6)}`
    const customerTitle = body.title.replace(/\bAI\b/gi, ' ').replace(/\s+/g, ' ').trim() || 'Interior Quotation'
    const customerNotes = (body.notes || '').replace(/\bAI\b/gi, ' ').replace(/\s+/g, ' ').trim() || null

    const { data: quote, error: quoteError } = await adminClient.from('designer_quotes').insert({
      designer_id: designer.id,
      project_id: job.project_id,
      quote_number: quoteNumber,
      title: customerTitle,
      description: body.description?.trim() || null,
      subtotal,
      discount_amount: body.discountAmount,
      tax_rate: body.taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      status: body.status,
      notes: customerNotes,
    }).select('id').maybeSingle()
    if (quoteError || !quote) throw new Error('QUOTE_SAVE_FAILED')

    const { error: itemsError } = await adminClient.from('quote_items').insert(normalizedItems.map(item => ({
      quote_id: quote.id,
      material_id: item.material?.id || null,
      item_type: item.itemType,
      name: item.material?.name || item.name.trim(),
      description: item.description?.trim() || '',
      number_of_units: item.numberOfUnits ?? 1,
      quantity: item.quantity,
      unit: item.material?.unit || item.unit,
      unit_price: item.unitPrice,
      discount_percent: item.discount,
      amount: item.amount,
      length: item.width || null,
      breadth: item.height || null,
      width: item.width || null,
      height: item.height || null,
      depth: item.depth || null,
      section: normalize(item.roomName) || 'on_site',
    })))
    if (itemsError) throw new Error('QUOTE_ITEMS_SAVE_FAILED')
    await adminClient.from('ai_quotation_jobs').update({ status: 'converted', updated_at: new Date().toISOString() }).eq('id', job.id)
    return json({ quoteId: quote.id, quoteNumber, subtotal, taxAmount, totalAmount })
  } catch (error) {
    console.error('ai quotation save failed', error)
    return json({ error: error instanceof Error && error.message === 'INVALID_MATERIAL' ? 'One catalogue item is no longer available.' : 'Could not save quotation draft.' }, 422)
  }
})
