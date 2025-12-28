// API Route para importar productos desde Mercado Libre
import { NextRequest, NextResponse } from 'next/server'
import { getItem, refreshAccessToken } from '@/src/lib/mercadolibre'
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

    if (error || !data) return null

    const tokens: MLTokens = JSON.parse(data.value as string)

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

// POST: Importar un item de ML como producto
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { ml_item_id, category_id } = body

        if (!ml_item_id) {
            return NextResponse.json(
                { error: 'ml_item_id es requerido' },
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

        // Verificar si ya existe un producto vinculado a este item
        const { data: existingListing } = await supabase
            .from('platform_listings')
            .select('product_variant_id')
            .eq('external_id', ml_item_id)
            .eq('platform', 'mercadolibre')
            .single()

        if (existingListing) {
            return NextResponse.json(
                { error: 'Este item ya está vinculado a un producto' },
                { status: 400 }
            )
        }

        // Obtener detalles del item de ML
        const mlItem = await getItem(tokens.access_token, ml_item_id)

        // Crear el producto
        const { data: product, error: productError } = await supabase
            .from('products')
            .insert({
                name: mlItem.title,
                description: `Importado de Mercado Libre - ${mlItem.id}`,
                base_price: mlItem.price,
                cost_price: 0, // El usuario puede ajustar después
                sku: mlItem.seller_sku || `ML-${mlItem.id}`,
                category_id: category_id || null,
                is_active: mlItem.status === 'active',
            })
            .select()
            .single()

        if (productError) {
            console.error('Error creating product:', productError)
            return NextResponse.json(
                { error: 'Error creando producto', details: productError.message },
                { status: 500 }
            )
        }

        // Si tiene variaciones, crear una variante por cada una
        // Si no, crear una variante por defecto
        const variants: { id: string; name: string; ml_variation_id?: number }[] = []

        if (mlItem.variations && mlItem.variations.length > 0) {
            for (const variation of mlItem.variations) {
                const variantName = variation.attribute_combinations
                    .map(attr => attr.value_name)
                    .join(' / ') || 'Variante'

                const { data: variant, error: variantError } = await supabase
                    .from('product_variants')
                    .insert({
                        product_id: product.id,
                        name: variantName,
                        sku: variation.seller_custom_field || `${product.sku}-${variation.id}`,
                        price_adjustment: variation.price - mlItem.price,
                        stock_quantity: variation.available_quantity,
                        min_stock_alert: 5,
                    })
                    .select()
                    .single()

                if (variantError) {
                    console.error('Error creating variant:', variantError)
                    continue
                }

                variants.push({
                    id: variant.id,
                    name: variantName,
                    ml_variation_id: variation.id,
                })

                // Crear vinculación con ML
                await supabase
                    .from('platform_listings')
                    .insert({
                        product_variant_id: variant.id,
                        platform: 'mercadolibre',
                        external_id: ml_item_id,
                        url: mlItem.permalink,
                        price: variation.price,
                        stock_synced: variation.available_quantity,
                        status: mlItem.status as 'active' | 'paused' | 'closed',
                        last_sync_at: new Date().toISOString(),
                    })
            }
        } else {
            // Producto sin variaciones - crear variante por defecto
            const { data: variant, error: variantError } = await supabase
                .from('product_variants')
                .insert({
                    product_id: product.id,
                    name: 'Principal',
                    sku: product.sku,
                    price_adjustment: 0,
                    stock_quantity: mlItem.available_quantity,
                    min_stock_alert: 5,
                })
                .select()
                .single()

            if (variantError) {
                console.error('Error creating variant:', variantError)
            } else {
                variants.push({
                    id: variant.id,
                    name: 'Principal',
                })

                // Crear vinculación con ML
                await supabase
                    .from('platform_listings')
                    .insert({
                        product_variant_id: variant.id,
                        platform: 'mercadolibre',
                        external_id: ml_item_id,
                        url: mlItem.permalink,
                        price: mlItem.price,
                        stock_synced: mlItem.available_quantity,
                        status: mlItem.status as 'active' | 'paused' | 'closed',
                        last_sync_at: new Date().toISOString(),
                    })
            }
        }

        // Guardar imagen principal si existe
        if (mlItem.pictures && mlItem.pictures.length > 0) {
            for (let i = 0; i < Math.min(mlItem.pictures.length, 5); i++) {
                await supabase
                    .from('product_images')
                    .insert({
                        product_id: product.id,
                        url: mlItem.pictures[i].url,
                        is_primary: i === 0,
                        sort_order: i,
                    })
            }
        }

        return NextResponse.json({
            success: true,
            product: {
                id: product.id,
                name: product.name,
                sku: product.sku,
            },
            variants,
            message: `Producto "${product.name}" importado con ${variants.length} variante(s)`,
        })
    } catch (err) {
        console.error('Error importing ML item:', err)
        return NextResponse.json(
            { error: 'Error importando producto', details: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
