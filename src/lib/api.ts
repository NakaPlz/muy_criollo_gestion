// Servicios para interactuar con la API de Supabase - Productos
import { createClient } from '@/lib/supabase/client'
import type {
    Product,
    ProductInsert,
    ProductUpdate,
    ProductVariant,
    ProductVariantInsert,
    ProductImage,
    ProductImageInsert,
    Category,
    ProductWithRelations
} from './types'

// Crear cliente de Supabase bajo demanda (no a nivel de módulo)
function getSupabase() {
    return createClient()
}

// ============================================
// CATEGORÍAS
// ============================================
export async function getCategories(): Promise<Category[]> {
    const { data, error } = await getSupabase()
        .from('categories')
        .select('*')
        .order('name')

    if (error) throw error
    return data || []
}

// ============================================
// PRODUCTOS
// ============================================
export async function getProducts(): Promise<ProductWithRelations[]> {
    const { data, error } = await getSupabase()
        .from('products')
        .select(`
      *,
      category:categories(*),
      variants:product_variants(*),
      images:product_images(*)
    `)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function getProductById(id: string): Promise<ProductWithRelations | null> {
    const { data, error } = await getSupabase()
        .from('products')
        .select(`
      *,
      category:categories(*),
      variants:product_variants(*),
      images:product_images(*)
    `)
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null // Not found
        throw error
    }
    return data
}

export async function createProduct(product: ProductInsert): Promise<Product> {
    const { data, error } = await getSupabase()
        .from('products')
        .insert(product)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateProduct(id: string, product: ProductUpdate): Promise<Product> {
    const { data, error } = await getSupabase()
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteProduct(id: string): Promise<void> {
    const { error } = await getSupabase()
        .from('products')
        .delete()
        .eq('id', id)

    if (error) throw error
}

// ============================================
// VARIANTES
// ============================================
export async function getVariantsByProductId(productId: string): Promise<ProductVariant[]> {
    const { data, error } = await getSupabase()
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('name')

    if (error) throw error
    return data || []
}

export async function createVariant(variant: ProductVariantInsert): Promise<ProductVariant> {
    const { data, error } = await getSupabase()
        .from('product_variants')
        .insert(variant)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updateVariant(id: string, variant: Partial<ProductVariantInsert>): Promise<ProductVariant> {
    const { data, error } = await getSupabase()
        .from('product_variants')
        .update(variant)
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteVariant(id: string): Promise<void> {
    const { error } = await getSupabase()
        .from('product_variants')
        .delete()
        .eq('id', id)

    if (error) throw error
}

// ============================================
// IMÁGENES
// ============================================
export async function createProductImage(image: ProductImageInsert): Promise<ProductImage> {
    const { data, error } = await getSupabase()
        .from('product_images')
        .insert(image)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function deleteProductImage(id: string): Promise<void> {
    const { error } = await getSupabase()
        .from('product_images')
        .delete()
        .eq('id', id)

    if (error) throw error
}

export async function setPrimaryImage(productId: string, imageId: string): Promise<void> {
    // First, set all images as non-primary
    await getSupabase()
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId)

    // Then set the selected image as primary
    const { error } = await getSupabase()
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId)

    if (error) throw error
}

// ============================================
// STOCK
// ============================================
export async function updateStock(variantId: string, quantity: number, type: 'IN' | 'OUT' | 'ADJUSTMENT', notes?: string): Promise<void> {
    // Update the variant stock
    const { data: variant, error: variantError } = await getSupabase()
        .from('product_variants')
        .select('stock_quantity')
        .eq('id', variantId)
        .single()

    if (variantError) throw variantError

    const newQuantity = type === 'ADJUSTMENT'
        ? quantity
        : type === 'IN'
            ? variant.stock_quantity + quantity
            : variant.stock_quantity - quantity

    // Update variant stock
    const { error: updateError } = await getSupabase()
        .from('product_variants')
        .update({ stock_quantity: newQuantity })
        .eq('id', variantId)

    if (updateError) throw updateError

    // Create stock movement record
    const { error: movementError } = await getSupabase()
        .from('stock_movements')
        .insert({
            product_variant_id: variantId,
            movement_type: type,
            quantity: type === 'OUT' ? -quantity : quantity,
            reference_type: 'adjustment',
            notes
        })

    if (movementError) throw movementError
}

// ============================================
// BÚSQUEDA Y FILTROS
// ============================================
export async function searchProducts(query: string): Promise<ProductWithRelations[]> {
    const { data, error } = await getSupabase()
        .from('products')
        .select(`
      *,
      category:categories(*),
      variants:product_variants(*),
      images:product_images(*)
    `)
        .or(`name.ilike.%${query}%,sku.ilike.%${query}%,description.ilike.%${query}%`)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function getProductsByCategory(categoryId: string): Promise<ProductWithRelations[]> {
    const { data, error } = await getSupabase()
        .from('products')
        .select(`
      *,
      category:categories(*),
      variants:product_variants(*),
      images:product_images(*)
    `)
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
}

export async function getLowStockProducts(threshold: number = 5): Promise<ProductVariant[]> {
    const { data, error } = await getSupabase()
        .from('product_variants')
        .select(`
      *,
      product:products(name, sku)
    `)
        .lte('stock_quantity', threshold)
        .order('stock_quantity')

    if (error) throw error
    return data || []
}

// ============================================
// CLIENTES
// ============================================
import type { Customer, CustomerInsert, Sale, SaleInsert, SaleItem, SaleItemInsert, SaleWithRelations } from './types'

export async function getCustomers(): Promise<Customer[]> {
    const { data, error } = await getSupabase()
        .from('customers')
        .select('*')
        .order('name')

    if (error) throw error
    return data || []
}

export async function getCustomerById(id: string): Promise<Customer | null> {
    const { data, error } = await getSupabase()
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null
        throw error
    }
    return data
}

export async function createCustomer(customer: CustomerInsert): Promise<Customer> {
    const { data, error } = await getSupabase()
        .from('customers')
        .insert(customer)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function searchCustomers(query: string): Promise<Customer[]> {
    const { data, error } = await getSupabase()
        .from('customers')
        .select('*')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,document_number.ilike.%${query}%`)
        .limit(10)

    if (error) throw error
    return data || []
}

// ============================================
// VENTAS
// ============================================
export async function getSales(): Promise<SaleWithRelations[]> {
    let allSales: SaleWithRelations[] = []
    let page = 0
    const pageSize = 1000
    // Límite de seguridad: 10 páginas (10.000 ventas)
    const maxPages = 10

    while (page < maxPages) {
        const { data, error } = await getSupabase()
            .from('sales')
            .select(`
                *,
                customer:customers(*),
                items:sale_items(
                    *,
                    product_variant:product_variants(
                        *,
                        product:products(name)
                    )
                )
            `)
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1)

        if (error) throw error

        if (!data || data.length === 0) break

        allSales = [...allSales, ...data]

        if (data.length < pageSize) break
        page++
    }

    return allSales
}

export async function getSaleById(id: string): Promise<SaleWithRelations | null> {
    const { data, error } = await getSupabase()
        .from('sales')
        .select(`
            *,
            customer:customers(*),
            items:sale_items(
                *,
                product_variant:product_variants(
                    *,
                    product:products(name)
                )
            )
        `)
        .eq('id', id)
        .single()

    if (error) {
        if (error.code === 'PGRST116') return null
        throw error
    }
    return data
}

export async function getNextSaleNumber(): Promise<string> {
    const { data, error } = await getSupabase()
        .from('sales')
        .select('sale_number')
        .order('created_at', { ascending: false })
        .limit(1)

    if (error) throw error

    if (!data || data.length === 0) {
        return 'V-0001'
    }

    const lastNumber = parseInt(data[0].sale_number.split('-')[1])
    return `V-${String(lastNumber + 1).padStart(4, '0')}`
}

export async function createSale(sale: SaleInsert, items: Omit<SaleItemInsert, 'sale_id'>[]): Promise<Sale> {
    // Create sale
    const { data: saleData, error: saleError } = await getSupabase()
        .from('sales')
        .insert(sale)
        .select()
        .single()

    if (saleError) throw saleError

    // Create sale items
    const itemsWithSaleId = items.map(item => ({
        ...item,
        sale_id: saleData.id
    }))

    const { error: itemsError } = await getSupabase()
        .from('sale_items')
        .insert(itemsWithSaleId)

    if (itemsError) throw itemsError

    // Update stock for each item
    for (const item of items) {
        if (item.product_variant_id) {
            const { data: variant, error: variantError } = await getSupabase()
                .from('product_variants')
                .select('stock_quantity')
                .eq('id', item.product_variant_id)
                .single()

            if (!variantError && variant) {
                await getSupabase()
                    .from('product_variants')
                    .update({ stock_quantity: variant.stock_quantity - item.quantity })
                    .eq('id', item.product_variant_id)

                // Create stock movement
                await getSupabase()
                    .from('stock_movements')
                    .insert({
                        product_variant_id: item.product_variant_id,
                        movement_type: 'OUT',
                        quantity: -item.quantity,
                        reference_type: 'sale',
                        reference_id: saleData.id,
                        notes: `Venta ${sale.sale_number}`
                    })
            }
        }
    }

    return saleData
}

export async function updateSaleStatus(id: string, status: string): Promise<Sale> {
    const { data, error } = await getSupabase()
        .from('sales')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

export async function updatePaymentStatus(id: string, paymentStatus: string): Promise<Sale> {
    const { data, error } = await getSupabase()
        .from('sales')
        .update({ payment_status: paymentStatus })
        .eq('id', id)
        .select()
        .single()

    if (error) throw error
    return data
}

// ============================================
// VARIANTES CON PRODUCTOS (para selector de ventas)
// ============================================
export async function getProductVariantsWithProduct(): Promise<(ProductVariant & { product: Product })[]> {
    const { data, error } = await getSupabase()
        .from('product_variants')
        .select(`
            *,
            product:products(*)
        `)
        .gt('stock_quantity', 0)
        .order('name')

    if (error) throw error
    return data || []
}

// ============================================
// ESTADÍSTICAS DEL DASHBOARD
// ============================================
export interface DashboardStats {
    totalSalesMonth: number
    totalSalesCount: number
    averageTicket: number
    lowStockCount: number
    pendingOrders: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    // Ventas del mes
    const { data: salesData, error: salesError } = await getSupabase()
        .from('sales')
        .select('total, status')
        .gte('created_at', startOfMonth.toISOString())

    if (salesError) throw salesError

    const sales = salesData || []
    const totalSalesMonth = sales.reduce((sum, s) => sum + (s.total || 0), 0)
    const totalSalesCount = sales.length
    const averageTicket = totalSalesCount > 0 ? totalSalesMonth / totalSalesCount : 0
    const pendingOrders = sales.filter(s => s.status === 'pending' || s.status === 'processing').length

    // Stock bajo (variantes con stock <= min_stock_alert)
    // Stock bajo (variantes con stock <= min_stock_alert)
    // Traemos todas las variantes (ligero, solo columnas necesarias) y filtramos en memoria
    // porque Supabase no permite comparar dos columnas (stock <= limit) directamente en el filtro simple
    const { data: variantsData, error: stockError } = await getSupabase()
        .from('product_variants')
        .select('stock_quantity, min_stock_alert')

    if (stockError) throw stockError

    const lowStockCount = (variantsData || []).filter(v =>
        (v.stock_quantity ?? 0) <= (v.min_stock_alert ?? 5)
    ).length

    if (stockError) throw stockError

    return {
        totalSalesMonth,
        totalSalesCount,
        averageTicket,
        lowStockCount: lowStockCount || 0,
        pendingOrders
    }
}

export async function getRecentSales(limit: number = 5): Promise<SaleWithRelations[]> {
    const { data, error } = await getSupabase()
        .from('sales')
        .select(`
            *,
            customer:customers(*),
            items:sale_items(product_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return data || []
}

export async function getSalesEvolution(months: number = 6): Promise<{ month: string; total: number }[]> {
    const result: { month: string; total: number }[] = []
    const now = new Date()

    for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)

        const { data, error } = await getSupabase()
            .from('sales')
            .select('total')
            .gte('created_at', startOfMonth.toISOString())
            .lte('created_at', endOfMonth.toISOString())

        if (error) throw error

        const total = (data || []).reduce((sum, s) => sum + (s.total || 0), 0)
        const monthName = date.toLocaleDateString('es-AR', { month: 'short' })
        result.push({ month: monthName.charAt(0).toUpperCase() + monthName.slice(1), total })
    }

    return result
}

export async function getLowStockVariants(): Promise<(ProductVariant & { product: { name: string } })[]> {
    const { data, error } = await getSupabase()
        .from('product_variants')
        .select(`
            *,
            product:products(name)
        `)
        .lte('stock_quantity', 10)
        .order('stock_quantity', { ascending: true })
        .limit(10)

    if (error) throw error
    return data || []
}


