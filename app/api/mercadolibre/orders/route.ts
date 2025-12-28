// API Route para sincronizar órdenes de Mercado Libre
import { NextRequest, NextResponse } from 'next/server'
import { getOrders, getUser, refreshAccessToken, MLOrder } from '@/src/lib/mercadolibre'
import { createClient } from '@/lib/supabase/server'

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

    if (error || !data) {
        console.log('No ML tokens found in settings:', error?.message)
        return null
    }

    // Handle both string and already-parsed JSON
    let tokens: MLTokens
    try {
        tokens = typeof data.value === 'string' ? JSON.parse(data.value) : data.value as MLTokens
    } catch (e) {
        console.error('Error parsing ML tokens:', e)
        return null
    }

    // Si el token está por expirar (menos de 5 minutos), refrescarlo
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

// GET: Obtener órdenes de ML
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const tokens = await getValidTokens(supabase)

        if (!tokens) {
            return NextResponse.json(
                { error: 'Mercado Libre no está conectado', needsAuth: true },
                { status: 401 }
            )
        }

        const searchParams = request.nextUrl.searchParams
        const offset = parseInt(searchParams.get('offset') || '0')
        const limit = parseInt(searchParams.get('limit') || '50')
        const status = searchParams.get('status') as 'paid' | 'pending' | 'cancelled' | undefined

        const ordersResponse = await getOrders(tokens.access_token, String(tokens.user_id), {
            offset,
            limit,
            status,
        })

        return NextResponse.json({
            orders: ordersResponse.results,
            paging: ordersResponse.paging,
        })
    } catch (err) {
        console.error('Error fetching ML orders:', err)
        return NextResponse.json(
            {
                error: 'Error obteniendo órdenes de Mercado Libre',
                details: err instanceof Error ? err.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}

// POST: Sincronizar órdenes a la base de datos local
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const tokens = await getValidTokens(supabase)

        if (!tokens) {
            return NextResponse.json(
                { error: 'Mercado Libre no está conectado', needsAuth: true },
                { status: 401 }
            )
        }

        // Obtener órdenes pagadas de las últimas 24 horas
        const ordersResponse = await getOrders(tokens.access_token, String(tokens.user_id), {
            limit: 50,
            status: 'paid',
        })

        let imported = 0
        let skipped = 0
        const errors: string[] = []

        for (const mlOrder of ordersResponse.results) {
            try {
                // Verificar si la orden ya existe
                const { data: existing } = await supabase
                    .from('sales')
                    .select('id')
                    .eq('ml_order_id', String(mlOrder.id))
                    .single()

                if (existing) {
                    skipped++
                    continue
                }

                // Crear la venta
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
                        notes: `Importado de Mercado Libre - Comprador: ${mlOrder.buyer.nickname}`,
                        created_at: mlOrder.date_created,
                    })
                    .select()
                    .single()

                if (saleError) {
                    errors.push(`Orden ${mlOrder.id}: ${saleError.message}`)
                    continue
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

                imported++
            } catch (err) {
                errors.push(`Orden ${mlOrder.id}: ${err instanceof Error ? err.message : 'Error desconocido'}`)
            }
        }

        return NextResponse.json({
            success: true,
            imported,
            skipped,
            total: ordersResponse.results.length,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (err) {
        console.error('Error syncing ML orders:', err)
        return NextResponse.json(
            { error: 'Error sincronizando órdenes de Mercado Libre' },
            { status: 500 }
        )
    }
}
