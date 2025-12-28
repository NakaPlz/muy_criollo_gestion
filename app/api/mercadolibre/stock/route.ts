// API Route para sincronizar stock con Mercado Libre
import { NextRequest, NextResponse } from 'next/server'
import { getItems, getItem, updateItemStock, refreshAccessToken } from '@/src/lib/mercadolibre'
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

// GET: Obtener items de ML con su stock
export async function GET() {
    try {
        const supabase = await createClient()
        const tokens = await getValidTokens(supabase)

        if (!tokens) {
            return NextResponse.json(
                { error: 'Mercado Libre no está conectado', needsAuth: true },
                { status: 401 }
            )
        }

        // Obtener IDs de items del vendedor
        const itemsResponse = await getItems(tokens.access_token, String(tokens.user_id), {
            status: 'active',
            limit: 50,
        })

        // Obtener detalles de cada item
        const items = await Promise.all(
            itemsResponse.results.map(async (itemId) => {
                try {
                    const item = await getItem(tokens.access_token, itemId)
                    return {
                        id: item.id,
                        title: item.title,
                        price: item.price,
                        available_quantity: item.available_quantity,
                        sold_quantity: item.sold_quantity,
                        status: item.status,
                        permalink: item.permalink,
                        thumbnail: item.thumbnail,
                        seller_sku: item.seller_sku,
                        variations: item.variations?.map(v => ({
                            id: v.id,
                            available_quantity: v.available_quantity,
                            seller_custom_field: v.seller_custom_field,
                            attributes: v.attribute_combinations,
                        })),
                    }
                } catch (err) {
                    console.error(`Error fetching item ${itemId}:`, err)
                    return null
                }
            })
        )

        // Filtrar nulls
        const validItems = items.filter(item => item !== null)

        // Obtener vinculaciones existentes de la BD
        const { data: listings } = await supabase
            .from('platform_listings')
            .select(`
                *,
                product_variant:product_variants(
                    id,
                    name,
                    sku,
                    stock_quantity,
                    product:products(name)
                )
            `)
            .eq('platform', 'mercadolibre')

        return NextResponse.json({
            ml_items: validItems,
            linked_items: listings || [],
            total_ml_items: itemsResponse.paging.total,
        })
    } catch (err) {
        console.error('Error fetching ML stock:', err)
        return NextResponse.json(
            {
                error: 'Error obteniendo stock de Mercado Libre',
                details: err instanceof Error ? err.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}

// POST: Sincronizar stock de la plataforma a ML
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { variant_id, ml_item_id, ml_variation_id } = body

        // Validar parámetros
        if (!variant_id || !ml_item_id) {
            return NextResponse.json(
                { error: 'variant_id y ml_item_id son requeridos' },
                { status: 400 }
            )
        }

        const supabase = await createClient()
        const tokens = await getValidTokens(supabase)

        if (!tokens) {
            return NextResponse.json(
                { error: 'Mercado Libre no está conectado', needsAuth: true },
                { status: 401 }
            )
        }

        // Obtener stock de la variante
        const { data: variant, error: variantError } = await supabase
            .from('product_variants')
            .select('stock_quantity, name, product:products(name)')
            .eq('id', variant_id)
            .single()

        if (variantError || !variant) {
            return NextResponse.json(
                { error: 'Variante no encontrada' },
                { status: 404 }
            )
        }

        // Actualizar stock en ML
        const updatedItem = await updateItemStock(
            tokens.access_token,
            ml_item_id,
            variant.stock_quantity
        )

        // Guardar/actualizar la vinculación en la BD
        const { error: linkError } = await supabase
            .from('platform_listings')
            .upsert({
                product_variant_id: variant_id,
                platform: 'mercadolibre',
                external_id: ml_item_id,
                price: updatedItem.price,
                stock_synced: variant.stock_quantity,
                status: updatedItem.status as 'active' | 'paused' | 'closed',
                last_sync_at: new Date().toISOString(),
            }, {
                onConflict: 'product_variant_id,platform'
            })

        if (linkError) {
            console.error('Error saving link:', linkError)
        }

        return NextResponse.json({
            success: true,
            variant_name: variant.name,
            ml_item_id: ml_item_id,
            stock_synced: variant.stock_quantity,
            ml_status: updatedItem.status,
        })
    } catch (err) {
        console.error('Error syncing stock:', err)
        return NextResponse.json(
            { error: 'Error sincronizando stock' },
            { status: 500 }
        )
    }
}

// PUT: Sincronizar todos los items vinculados
export async function PUT() {
    try {
        const supabase = await createClient()
        const tokens = await getValidTokens(supabase)

        if (!tokens) {
            return NextResponse.json(
                { error: 'Mercado Libre no está conectado', needsAuth: true },
                { status: 401 }
            )
        }

        // Obtener todas las vinculaciones
        const { data: listings, error: listingsError } = await supabase
            .from('platform_listings')
            .select(`
                *,
                product_variant:product_variants(
                    id,
                    stock_quantity
                )
            `)
            .eq('platform', 'mercadolibre')

        if (listingsError) {
            return NextResponse.json(
                { error: 'Error obteniendo vinculaciones' },
                { status: 500 }
            )
        }

        let synced = 0
        let errors: string[] = []

        for (const listing of listings || []) {
            try {
                if (!listing.product_variant || !listing.external_id) continue

                const newStock = listing.product_variant.stock_quantity

                // Solo sincronizar si el stock cambió
                if (newStock !== listing.stock_synced) {
                    await updateItemStock(
                        tokens.access_token,
                        listing.external_id,
                        newStock
                    )

                    // Actualizar registro
                    await supabase
                        .from('platform_listings')
                        .update({
                            stock_synced: newStock,
                            last_sync_at: new Date().toISOString(),
                        })
                        .eq('id', listing.id)

                    synced++
                }
            } catch (err) {
                errors.push(`Item ${listing.external_id}: ${err instanceof Error ? err.message : 'Error'}`)
            }
        }

        return NextResponse.json({
            success: true,
            synced,
            total: listings?.length || 0,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (err) {
        console.error('Error syncing all stock:', err)
        return NextResponse.json(
            { error: 'Error sincronizando stock' },
            { status: 500 }
        )
    }
}
