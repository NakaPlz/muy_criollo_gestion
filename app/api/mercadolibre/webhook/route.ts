// API Route para recibir notificaciones de Mercado Libre
// Documentación: https://developers.mercadolibre.com.ar/es_ar/producto-recibe-notificaciones
import { NextRequest, NextResponse } from 'next/server'
import { getOrder, refreshAccessToken } from '@/src/lib/mercadolibre'
import { createClient } from '@/lib/supabase/server'

interface MLNotification {
    _id: string
    resource: string  // ej: /orders/123456789
    user_id: number
    topic: string     // ej: orders_v2, items, questions, payments
    application_id: number
    attempts: number
    sent: string
    received: string
}

interface MLTokens {
    access_token: string
    refresh_token: string
    user_id: number
    expires_at: number
}

async function getValidTokens(supabase: Awaited<ReturnType<typeof createClient>>): Promise<MLTokens | null> {
    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'ml_tokens')
        .single()

    if (error || !data) return null

    const tokens: MLTokens = JSON.parse(data.value as string)

    // Si el token está por expirar, refrescarlo
    if (tokens.expires_at < Date.now() + 300000) {
        try {
            const newTokens = await refreshAccessToken(tokens.refresh_token)
            const updatedTokens: MLTokens = {
                access_token: newTokens.access_token,
                refresh_token: newTokens.refresh_token,
                user_id: newTokens.user_id,
                expires_at: Date.now() + (newTokens.expires_in * 1000),
            }

            await supabase
                .from('settings')
                .update({
                    value: JSON.stringify(updatedTokens),
                    updated_at: new Date().toISOString(),
                })
                .eq('key', 'ml_tokens')

            return updatedTokens
        } catch (err) {
            console.error('Error refreshing ML token:', err)
            return null
        }
    }

    return tokens
}

export async function POST(request: NextRequest) {
    try {
        const notification: MLNotification = await request.json()

        console.log('📬 ML Notification received:', {
            topic: notification.topic,
            resource: notification.resource,
            user_id: notification.user_id,
        })

        // Solo procesamos notificaciones de órdenes
        if (notification.topic !== 'orders_v2' && notification.topic !== 'orders') {
            console.log(`Ignoring notification topic: ${notification.topic}`)
            return NextResponse.json({ received: true })
        }

        // Extraer order_id del resource (ej: /orders/123456789)
        const orderIdMatch = notification.resource.match(/\/orders\/(\d+)/)
        if (!orderIdMatch) {
            console.error('Could not extract order ID from resource:', notification.resource)
            return NextResponse.json({ received: true })
        }

        const orderId = orderIdMatch[1]

        const supabase = await createClient()
        const tokens = await getValidTokens(supabase)

        if (!tokens) {
            console.error('No valid ML tokens found')
            return NextResponse.json({ error: 'No ML tokens' }, { status: 401 })
        }

        // Verificar si la orden ya existe
        const { data: existing } = await supabase
            .from('sales')
            .select('id')
            .eq('ml_order_id', orderId)
            .single()

        if (existing) {
            console.log(`Order ${orderId} already exists, skipping`)
            return NextResponse.json({ received: true, skipped: true })
        }

        // Obtener detalles de la orden
        const mlOrder = await getOrder(tokens.access_token, orderId)

        // Solo importamos órdenes pagadas
        if (mlOrder.status !== 'paid') {
            console.log(`Order ${orderId} status is ${mlOrder.status}, skipping`)
            return NextResponse.json({ received: true, skipped: true })
        }

        // Crear la venta en la BD
        const saleNumber = `ML-${mlOrder.id}`
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
                sale_number: saleNumber,
                channel: 'ML',
                ml_order_id: String(mlOrder.id),
                status: 'completed',
                subtotal: mlOrder.total_amount,
                discount: 0,
                shipping_cost: 0,
                total: mlOrder.total_amount,
                payment_method: 'Pago Online',
                payment_status: 'paid',
                notes: `Importado automáticamente de ML - Comprador: ${mlOrder.buyer.nickname}`,
                created_at: mlOrder.date_created,
            })
            .select()
            .single()

        if (saleError) {
            console.error('Error creating sale:', saleError)
            return NextResponse.json({ error: 'Error creating sale' }, { status: 500 })
        }

        // Crear los items de la venta y descontar stock
        for (const item of mlOrder.order_items) {
            // 1. Crear item en sale_items de postgres
            const { data: saleItem, error: saleItemError } = await supabase
                .from('sale_items')
                .insert({
                    sale_id: sale.id,
                    product_name: item.item.title,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.quantity * item.unit_price,
                })
                .select()
                .single()

            if (saleItemError) {
                console.error('Error creating sale item:', saleItemError)
                continue
            }

            // 2. Intentar descontar stock
            // Buscamos el producto vinculado usando el item_id y variation_id de ML
            let query = supabase
                .from('platform_listings')
                .select('product_variant_id, product_variant:product_variants(stock_quantity)')
                .eq('platform', 'mercadolibre')
                .eq('external_id', item.item.id)

            if (item.item.variation_id) {
                // Si tiene variación, intentamos buscar por variation_id específico
                // Primero intentamos match exacto por external_variant_id
                const { data: specificVariant } = await supabase
                    .from('platform_listings')
                    .select('product_variant_id, product_variant:product_variants(stock_quantity)')
                    .eq('platform', 'mercadolibre')
                    .eq('external_variant_id', String(item.item.variation_id))
                    .single()

                if (specificVariant) {
                    await updateLocalStock(supabase, specificVariant.product_variant_id, item.quantity, sale.id, saleNumber)
                    // Actualizamos la referencia en el sale_item
                    await supabase.from('sale_items').update({ product_variant_id: specificVariant.product_variant_id }).eq('id', saleItem.id)
                    continue
                }
            }

            // Si no tiene variación o no encontramos match exacto, probamos con el item principal
            const { data: genericListing } = await query.maybeSingle()

            if (genericListing) {
                await updateLocalStock(supabase, genericListing.product_variant_id, item.quantity, sale.id, saleNumber)
                await supabase.from('sale_items').update({ product_variant_id: genericListing.product_variant_id }).eq('id', saleItem.id)
            } else {
                console.warn(`No local product found for ML Item ${item.item.id} (Variation: ${item.item.variation_id})`)
            }
        }

        console.log(`✅ Order ${orderId} imported successfully as sale ${saleNumber}`)

        return NextResponse.json({
            received: true,
            imported: true,
            sale_id: sale.id,
            sale_number: saleNumber,
        })
    } catch (err) {
        console.error('Error processing ML notification:', err)
        return NextResponse.json({
            error: 'Error processing notification',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 })
    }
}


// Helper para descontar stock y registrar movimiento
async function updateLocalStock(
    supabase: any,
    variantId: string,
    quantity: number,
    saleId: string,
    saleNumber: string
) {
    if (!variantId) return

    try {
        // 1. Obtener stock actual
        const { data: variant } = await supabase
            .from('product_variants')
            .select('stock_quantity')
            .eq('id', variantId)
            .single()

        if (!variant) return

        // 2. Restar stock
        await supabase
            .from('product_variants')
            .update({ stock_quantity: variant.stock_quantity - quantity })
            .eq('id', variantId)

        // 3. Registrar movimiento
        await supabase
            .from('stock_movements')
            .insert({
                product_variant_id: variantId,
                movement_type: 'OUT',
                quantity: -quantity,
                reference_type: 'sale',
                reference_id: saleId,
                notes: `Venta ML #${saleNumber}`
            })

    } catch (e) {
        console.error('Error updating local stock:', e)
    }
}

// GET para verificar que el endpoint está funcionando
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'ML Webhook endpoint is active',
        timestamp: new Date().toISOString(),
    })
}
