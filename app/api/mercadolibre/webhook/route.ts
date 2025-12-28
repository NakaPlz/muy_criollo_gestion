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

        // Crear los items de la venta
        for (const item of mlOrder.order_items) {
            await supabase
                .from('sale_items')
                .insert({
                    sale_id: sale.id,
                    product_name: item.item.title,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    total_price: item.quantity * item.unit_price,
                })
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

// GET para verificar que el endpoint está funcionando
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'ML Webhook endpoint is active',
        timestamp: new Date().toISOString(),
    })
}
