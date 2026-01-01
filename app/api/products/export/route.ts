import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const supabase = await createClient()

        let allProducts: any[] = []
        let page = 0
        const pageSize = 1000
        const maxPages = 50 // Limit safety

        // 1. Fetch all products recursively
        while (page < maxPages) {
            const { data, error } = await supabase
                .from('products')
                .select(`
                    *,
                    category:categories(name),
                    variants:product_variants(*),
                    images:product_images(*)
                `)
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (error) throw error
            if (!data || data.length === 0) break

            allProducts = [...allProducts, ...data]
            if (data.length < pageSize) break
            page++
        }

        // 2. Transform to CSV friendly format
        // We will output one row per VARIANT if variants exist, or one row per PRODUCT if no variants.
        // Actually, for web imports usually we want one row per product, but if it has variants, we might need multiple rows or a flattened structure.
        // Let's do a "Main Product + Variant" structure (Shopify style-ish).

        const rows = []
        const headers = [
            'ID', 'Tipo', 'SKU', 'Nombre', 'Categoria', 'Precio', 'Costo', 'Stock', 'Alerta Stock', 'Descripcion', 'Imagen URL', 'Activo'
        ]

        // Header Row
        rows.push(headers.join(','))

        for (const p of allProducts) {
            const hasVariants = p.variants && p.variants.length > 0
            const cleanDesc = p.description ? p.description.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""') : ""
            const categoryName = p.category?.name || ""
            const imageUrl = p.images?.[0]?.url || ""

            if (hasVariants) {
                // Determine total stock from variants
                // However, export usually wants details. Let's export each variant as a row.
                // First row: Product info (parent)? 
                // Let's keep it simple: One row per sellable item (Variant or Simple Product).

                for (const v of p.variants) {
                    const price = p.base_price + (v.price_adjustment || 0)
                    const variantName = v.name === 'Default' ? p.name : `${p.name} - ${v.name}`

                    const row = [
                        v.id, // ID unique for variant
                        'Variant',
                        v.sku || p.sku || '',
                        `"${variantName.replace(/"/g, '""')}"`,
                        `"${categoryName}"`,
                        price,
                        p.cost_price,
                        v.stock_quantity,
                        v.min_stock_alert,
                        `"${cleanDesc}"`,
                        imageUrl,
                        p.is_active ? 'Si' : 'No'
                    ]
                    rows.push(row.join(','))
                }
            } else {
                // Simple product (no variants explicitly created, likely conceptual "Default" variant implied or just simple)
                // If the system creates variants for everything, this block might not be hit often.
                // But if 'variants' is empty, we act as simple product.

                // Note: The system might enforce variants. Assuming "Simple" maps to "No variants array".
                const row = [
                    p.id,
                    'Simple',
                    p.sku || '',
                    `"${p.name.replace(/"/g, '""')}"`,
                    `"${categoryName}"`,
                    p.base_price,
                    p.cost_price,
                    0, // Stock undefined if no variants? Or should lookup? (In this system stock is on variants usually)
                    5, // Default alert
                    `"${cleanDesc}"`,
                    imageUrl,
                    p.is_active ? 'Si' : 'No'
                ]
                rows.push(row.join(','))
            }
        }

        const csvContent = "\uFEFF" + rows.join('\n') // BOM for Excel

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="productos_mc_${new Date().toISOString().split('T')[0]}.csv"`
            }
        })

    } catch (error: any) {
        console.error('Export error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
