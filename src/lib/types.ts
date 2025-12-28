// Tipos generados desde el esquema de Supabase
// Base de datos: Muy Criollo

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

// ============================================
// CATEGORÍAS
// ============================================
export interface Category {
    id: string
    name: string
    slug: string
    description: string | null
    created_at: string
}

export type CategoryInsert = Omit<Category, 'id' | 'created_at'>
export type CategoryUpdate = Partial<CategoryInsert>

// ============================================
// PRODUCTOS
// ============================================
export interface Product {
    id: string
    category_id: string | null
    name: string
    description: string | null
    base_price: number
    cost_price: number
    sku: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    // Relaciones
    category?: Category
    variants?: ProductVariant[]
    images?: ProductImage[]
}

export type ProductInsert = Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category' | 'variants' | 'images'>
export type ProductUpdate = Partial<ProductInsert>

// ============================================
// VARIANTES DE PRODUCTOS
// ============================================
export interface ProductVariant {
    id: string
    product_id: string
    name: string
    sku: string | null
    price_adjustment: number
    stock_quantity: number
    min_stock_alert: number
    created_at: string
}

export type ProductVariantInsert = Omit<ProductVariant, 'id' | 'created_at'>
export type ProductVariantUpdate = Partial<ProductVariantInsert>

// ============================================
// IMÁGENES DE PRODUCTOS
// ============================================
export interface ProductImage {
    id: string
    product_id: string
    url: string
    is_primary: boolean
    sort_order: number
}

export type ProductImageInsert = Omit<ProductImage, 'id'>
export type ProductImageUpdate = Partial<ProductImageInsert>

// ============================================
// CLIENTES
// ============================================
export interface Customer {
    id: string
    name: string
    email: string | null
    phone: string | null
    document_type: string | null
    document_number: string | null
    tax_condition: string | null
    address: string | null
    city: string | null
    province: string | null
    notes: string | null
    source: 'ML' | 'Instagram' | 'WhatsApp' | 'Presencial' | null
    ml_user_id: string | null
    created_at: string
}

export type CustomerInsert = Omit<Customer, 'id' | 'created_at'>
export type CustomerUpdate = Partial<CustomerInsert>

// ============================================
// VENTAS
// ============================================
export type SaleChannel = 'ML' | 'Instagram' | 'WhatsApp' | 'Presencial'
export type SaleStatus = 'pending' | 'processing' | 'completed' | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'refunded'

export interface Sale {
    id: string
    customer_id: string | null
    sale_number: string
    channel: SaleChannel
    ml_order_id: string | null
    status: SaleStatus
    subtotal: number
    discount: number
    shipping_cost: number
    total: number
    payment_method: string | null
    payment_status: PaymentStatus
    notes: string | null
    created_at: string
    updated_at: string
    // Relaciones
    customer?: Customer
    items?: SaleItem[]
}

export type SaleInsert = Omit<Sale, 'id' | 'created_at' | 'updated_at' | 'customer' | 'items'>
export type SaleUpdate = Partial<SaleInsert>

// ============================================
// ITEMS DE VENTA
// ============================================
export interface SaleItem {
    id: string
    sale_id: string
    product_variant_id: string | null
    product_name: string
    quantity: number
    unit_price: number
    total_price: number
    // Relaciones
    product_variant?: ProductVariant
}

export type SaleItemInsert = Omit<SaleItem, 'id' | 'product_variant'>
export type SaleItemUpdate = Partial<SaleItemInsert>

// ============================================
// MOVIMIENTOS DE STOCK
// ============================================
export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT'
export type StockReferenceType = 'sale' | 'purchase' | 'adjustment' | 'sync'

export interface StockMovement {
    id: string
    product_variant_id: string
    movement_type: StockMovementType
    quantity: number
    reference_type: StockReferenceType | null
    reference_id: string | null
    notes: string | null
    created_at: string
    created_by: string | null
}

export type StockMovementInsert = Omit<StockMovement, 'id' | 'created_at'>
export type StockMovementUpdate = Partial<StockMovementInsert>

// ============================================
// FACTURAS
// ============================================
export type InvoiceType = 'A' | 'B'
export type InvoiceStatus = 'issued' | 'cancelled'

export interface Invoice {
    id: string
    sale_id: string | null
    invoice_type: InvoiceType
    invoice_number: string
    point_of_sale: number
    cae: string | null
    cae_expiration: string | null
    customer_name: string
    customer_document: string
    customer_tax_condition: string
    subtotal: number
    iva_21: number
    iva_10_5: number
    total: number
    pdf_url: string | null
    status: InvoiceStatus
    created_at: string
}

export type InvoiceInsert = Omit<Invoice, 'id' | 'created_at'>
export type InvoiceUpdate = Partial<InvoiceInsert>

// ============================================
// PROVEEDORES
// ============================================
export interface Supplier {
    id: string
    name: string
    contact_name: string | null
    phone: string | null
    email: string | null
    address: string | null
    cuit: string | null
    notes: string | null
    provides_invoice: boolean
    created_at: string
}

export type SupplierInsert = Omit<Supplier, 'id' | 'created_at'>
export type SupplierUpdate = Partial<SupplierInsert>

// ============================================
// ÓRDENES DE COMPRA
// ============================================
export type PurchaseOrderStatus = 'pending' | 'received' | 'partial'

export interface PurchaseOrder {
    id: string
    supplier_id: string | null
    order_number: string
    status: PurchaseOrderStatus
    subtotal: number
    total: number
    has_invoice: boolean
    supplier_invoice_number: string | null
    notes: string | null
    ordered_at: string
    received_at: string | null
    created_at: string
    // Relaciones
    supplier?: Supplier
    items?: PurchaseItem[]
}

export type PurchaseOrderInsert = Omit<PurchaseOrder, 'id' | 'created_at' | 'supplier' | 'items'>
export type PurchaseOrderUpdate = Partial<PurchaseOrderInsert>

// ============================================
// ITEMS DE COMPRA
// ============================================
export interface PurchaseItem {
    id: string
    purchase_order_id: string
    product_variant_id: string | null
    product_name: string
    quantity: number
    quantity_received: number
    unit_cost: number
    total_cost: number
}

export type PurchaseItemInsert = Omit<PurchaseItem, 'id'>
export type PurchaseItemUpdate = Partial<PurchaseItemInsert>

// ============================================
// COMPETIDORES
// ============================================
export interface Competitor {
    id: string
    name: string
    ml_seller_id: string | null
    url: string | null
    notes: string | null
    is_active: boolean
    created_at: string
}

export type CompetitorInsert = Omit<Competitor, 'id' | 'created_at'>
export type CompetitorUpdate = Partial<CompetitorInsert>

// ============================================
// PRECIOS DE COMPETENCIA
// ============================================
export interface CompetitorPrice {
    id: string
    competitor_id: string
    product_id: string | null
    ml_item_id: string | null
    title: string
    price: number
    original_price: number | null
    stock_status: 'available' | 'out_of_stock' | null
    condition: 'new' | 'used' | null
    url: string | null
    captured_at: string
}

export type CompetitorPriceInsert = Omit<CompetitorPrice, 'id' | 'captured_at'>
export type CompetitorPriceUpdate = Partial<CompetitorPriceInsert>

// ============================================
// PUBLICACIONES EN PLATAFORMAS
// ============================================
export type Platform = 'mercadolibre' | 'web'
export type ListingStatus = 'active' | 'paused' | 'closed'

export interface PlatformListing {
    id: string
    product_variant_id: string
    platform: Platform
    external_id: string | null
    url: string | null
    price: number
    stock_synced: number
    status: ListingStatus
    last_sync_at: string | null
    created_at: string
}

export type PlatformListingInsert = Omit<PlatformListing, 'id' | 'created_at'>
export type PlatformListingUpdate = Partial<PlatformListingInsert>

// ============================================
// CONFIGURACIÓN
// ============================================
export interface Setting {
    id: string
    key: string
    value: Json
    category: 'company' | 'billing' | 'integrations' | 'notifications'
    updated_at: string
}

export type SettingInsert = Omit<Setting, 'id' | 'updated_at'>
export type SettingUpdate = Partial<SettingInsert>

// ============================================
// TIPOS UTILITARIOS
// ============================================
export type ProductWithRelations = Omit<Product, 'category' | 'variants' | 'images'> & {
    category: Category | null
    variants: ProductVariant[]
    images: ProductImage[]
}

export type SaleWithRelations = Omit<Sale, 'customer' | 'items'> & {
    customer: Customer | null
    items: SaleItem[]
}

