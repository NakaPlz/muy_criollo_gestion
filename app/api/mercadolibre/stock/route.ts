// API Route para sincronizar stock con Mercado Libre
import { NextRequest, NextResponse } from 'next/server'
import { getItems, getItem, getItemsMulti, updateItemStock, refreshAccessToken, MLItem, mlFetch } from '@/src/lib/mercadolibre'
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

        // Obtener detalles de todos los items en pocas llamadas (20 por llamada)
        const mlItems = await getItemsMulti(tokens.access_token, itemsResponse.results)

        // Mapear a la estructura que necesitamos
        const items = mlItems.map(item => ({
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
        }))

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
            ml_items: items,
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

// PUT: Sincronizar stock (Push: Local -> ML, Pull: ML -> Local)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const direction = body.direction || 'push' // 'push' or 'pull'

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
                    stock_quantity,
                    sku
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

        if (direction === 'push') {
            // PUSH: Local -> Mercado Libre
            for (const listing of listings || []) {
                try {
                    if (!listing.product_variant || !listing.external_id) continue

                    const localStock = listing.product_variant.stock_quantity

                    // Solo sincronizar si el stock cambió
                    if (localStock !== listing.stock_synced) {
                        if (listing.external_variant_id) {
                            // Actualizar variación específica
                            // Nota: ML requiere actualizar el item completo enviando las variaciones
                            // Esto es complejo por la API de ML, simplificamos asumiendo que el usuario gestiona stock
                            // Para variaciones, lo ideal es usar el endpoint de /items/{id}/variations/{id} si existe,
                            // o actualizar el item completo. Por ahora, si tiene variaciones, saltamos la actualización directa
                            // a menos que implementemos la lógica completa de item update.
                            // SIN EMBARGO, para stock, podemos usar /items/{id}/variations/{variation_id} ?
                            // ML API Docs dicen PUT /items/{id}/variations/{variation_id} body: { available_quantity: 10 }

                            await mlFetch(
                                `/items/${listing.external_id}/variations/${listing.external_variant_id}`,
                                tokens.access_token,
                                {
                                    method: 'PUT',
                                    body: JSON.stringify({ available_quantity: localStock })
                                }
                            )
                        } else {
                            // Item simple
                            await updateItemStock(
                                tokens.access_token,
                                listing.external_id,
                                localStock
                            )
                        }

                        // Actualizar registro
                        await supabase
                            .from('platform_listings')
                            .update({
                                stock_synced: localStock,
                                last_sync_at: new Date().toISOString(),
                            })
                            .eq('id', listing.id)

                        synced++
                    }
                } catch (err) {
                    errors.push(`Item ${listing.external_id}: ${err instanceof Error ? err.message : 'Error'}`)
                }
            }
        } else {
            // PULL: Mercado Libre -> Local
            // 1. Obtener status actual de ML para todos los items vinculados
            const uniqueItemIds = Array.from(new Set(listings?.map(l => l.external_id) || []))
            const mlItems = await getItemsMulti(tokens.access_token, uniqueItemIds as string[])

            // Mapa para búsqueda rápida
            const mlItemMap = new Map(mlItems.map(i => [i.id, i]))

            for (const listing of listings || []) {
                try {
                    if (!listing.product_variant || !listing.external_id) continue

                    const mlItem = mlItemMap.get(listing.external_id)
                    if (!mlItem) continue

                    let mlStock = 0
                    let matchedVariationId: string | null = null

                    if (listing.external_variant_id) {
                        // Caso ideal: Ya tenemos el ID de variación vinculado
                        const variation = mlItem.variations?.find(v => String(v.id) === listing.external_variant_id)
                        if (variation) {
                            mlStock = variation.available_quantity
                        } else if (!mlItem.variations || mlItem.variations.length === 0) {
                            // Fallback: Si ML dice que no hay variaciones pero nosotros teníamos ID (caso raro, quizas cambió la publicacion)
                            mlStock = mlItem.available_quantity
                        } else {
                            // Variation ID no encontrado en ML (quizás eliminada?)
                            continue
                        }
                    } else {
                        // Caso problemático: No tenemos external_variant_id
                        if (mlItem.variations && mlItem.variations.length > 0) {
                            // ML tiene variaciones, pero nosotros no sabemos cuál es cuál.
                            // INTENTO DE RECUPERACIÓN (Self-healing)

                            const localSku = listing.product_variant.sku
                            let matchedVariation = null

                            if (localSku) {
                                // Estrategia 1: Buscar si el SKU de ML coincide con el nuestro
                                matchedVariation = mlItem.variations.find(v => v.seller_custom_field === localSku)

                                // Estrategia 2: Buscar si nuestro SKU contiene el ID de variación (patrón usado en importación: SKU-VAR_ID)
                                if (!matchedVariation) {
                                    matchedVariation = mlItem.variations.find(v => localSku.includes(String(v.id)))
                                }
                            }

                            if (matchedVariation) {
                                // Match encontrado! Actualizamos la vinculación para el futuro
                                await supabase
                                    .from('platform_listings')
                                    .update({ external_variant_id: String(matchedVariation.id) })
                                    .eq('id', listing.id)

                                mlStock = matchedVariation.available_quantity
                            } else {
                                // CRÍTICO: Si no podemos matchear, NO actualizamos stock
                                // Evitamos el bug de asignar el stock total a una variante
                                errors.push(`Saltado ${listing.external_id}: Requiere vinculación manual de variante`)
                                continue
                            }
                        } else {
                            // Item simple sin variaciones en ML
                            mlStock = mlItem.available_quantity
                        }
                    }

                    // Si el stock es diferente, actualizar local
                    if (mlStock !== listing.product_variant.stock_quantity) {
                        // Actualizar stock local
                        await supabase
                            .from('product_variants')
                            .update({ stock_quantity: mlStock })
                            .eq('id', listing.product_variant.id)

                        // Crear movimiento de stock (ajuste por sync)
                        await supabase
                            .from('stock_movements')
                            .insert({
                                product_variant_id: listing.product_variant.id,
                                movement_type: mlStock > listing.product_variant.stock_quantity ? 'IN' : 'OUT',
                                quantity: Math.abs(mlStock - listing.product_variant.stock_quantity),
                                reference_type: 'sync',
                                notes: 'Sincronización manual desde Mercado Libre'
                            })

                        // Actualizar listing
                        await supabase
                            .from('platform_listings')
                            .update({
                                stock_synced: mlStock,
                                last_sync_at: new Date().toISOString(),
                            })
                            .eq('id', listing.id)

                        synced++
                    }

                } catch (err) {
                    errors.push(`Item ${listing.external_id}: ${err instanceof Error ? err.message : 'Error'}`)
                }
            }
        }

        return NextResponse.json({
            success: true,
            synced,
            total: listings?.length || 0,
            direction,
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


