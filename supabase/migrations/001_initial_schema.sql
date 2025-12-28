-- ============================================
-- MIGRACIÓN: Esquema de Base de Datos Muy Criollo
-- Fecha: 2024-12-27
-- ============================================

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CATEGORÍAS DE PRODUCTOS
-- ============================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. PRODUCTOS
-- ============================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(12,2) DEFAULT 0,
    sku TEXT UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. VARIANTES DE PRODUCTOS
-- ============================================
CREATE TABLE product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    price_adjustment DECIMAL(12,2) DEFAULT 0,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. IMÁGENES DE PRODUCTOS
-- ============================================
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0
);

-- ============================================
-- 5. CLIENTES
-- ============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    document_type TEXT, -- DNI, CUIT, CUIL
    document_number TEXT,
    tax_condition TEXT, -- Consumidor Final, Resp. Inscripto, Monotributista, Exento
    address TEXT,
    city TEXT,
    province TEXT,
    notes TEXT,
    source TEXT, -- ML, Instagram, WhatsApp, Presencial
    ml_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. VENTAS
-- ============================================
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    sale_number TEXT UNIQUE NOT NULL,
    channel TEXT NOT NULL, -- ML, Instagram, WhatsApp, Presencial
    ml_order_id TEXT,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, cancelled
    subtotal DECIMAL(12,2) DEFAULT 0,
    discount DECIMAL(12,2) DEFAULT 0,
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    payment_method TEXT, -- Efectivo, MP, Transferencia
    payment_status TEXT DEFAULT 'pending', -- pending, paid, refunded
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. ITEMS DE VENTA
-- ============================================
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL, -- Guardamos el nombre por si se elimina el producto
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL
);

-- ============================================
-- 8. MOVIMIENTOS DE STOCK
-- ============================================
CREATE TABLE stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    movement_type TEXT NOT NULL, -- IN, OUT, ADJUSTMENT
    quantity INTEGER NOT NULL,
    reference_type TEXT, -- sale, purchase, adjustment, sync
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID
);

-- ============================================
-- 9. FACTURAS
-- ============================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    invoice_type TEXT NOT NULL, -- A, B (no C porque es Resp. Inscripto)
    invoice_number TEXT UNIQUE NOT NULL,
    point_of_sale INTEGER NOT NULL,
    cae TEXT,
    cae_expiration DATE,
    customer_name TEXT NOT NULL,
    customer_document TEXT NOT NULL,
    customer_tax_condition TEXT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    iva_21 DECIMAL(12,2) DEFAULT 0,
    iva_10_5 DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    pdf_url TEXT,
    status TEXT DEFAULT 'issued', -- issued, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. PROVEEDORES
-- ============================================
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    cuit TEXT,
    notes TEXT,
    provides_invoice BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. ÓRDENES DE COMPRA
-- ============================================
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    order_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, received, partial
    subtotal DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    has_invoice BOOLEAN DEFAULT false,
    supplier_invoice_number TEXT,
    notes TEXT,
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. ITEMS DE COMPRA
-- ============================================
CREATE TABLE purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    quantity_received INTEGER DEFAULT 0,
    unit_cost DECIMAL(12,2) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL
);

-- ============================================
-- 13. COMPETIDORES
-- ============================================
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    ml_seller_id TEXT,
    url TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 14. PRECIOS DE COMPETENCIA
-- ============================================
CREATE TABLE competitor_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    ml_item_id TEXT,
    title TEXT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    original_price DECIMAL(12,2),
    stock_status TEXT, -- available, out_of_stock
    condition TEXT, -- new, used
    url TEXT,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 15. PUBLICACIONES EN PLATAFORMAS
-- ============================================
CREATE TABLE platform_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL, -- mercadolibre, web
    external_id TEXT,
    url TEXT,
    price DECIMAL(12,2) NOT NULL,
    stock_synced INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, paused, closed
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. CONFIGURACIÓN
-- ============================================
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    category TEXT NOT NULL, -- company, billing, integrations, notifications
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA MEJORAR PERFORMANCE
-- ============================================
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_channel ON sales(channel);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_created ON sales(created_at DESC);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_stock_movements_variant ON stock_movements(product_variant_id);
CREATE INDEX idx_invoices_sale ON invoices(sale_id);
CREATE INDEX idx_competitor_prices_competitor ON competitor_prices(competitor_id);
CREATE INDEX idx_platform_listings_variant ON platform_listings(product_variant_id);

-- ============================================
-- TRIGGERS PARA ACTUALIZAR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Categorías iniciales
INSERT INTO categories (name, slug, description) VALUES
('Sombreros', 'sombreros', 'Sombreros gauchos y tradicionales - Producto estrella'),
('Camperas de Cuero', 'camperas-cuero', 'Camperas y chaquetas de cuero'),
('Cuchillería', 'cuchilleria', 'Cuchillos y facones'),
('Billeteras de Cuero', 'billeteras-cuero', 'Billeteras y tarjeteros de cuero'),
('Mochilas de Cuero', 'mochilas-cuero', 'Mochilas y bolsos de cuero'),
('Cinturones de Cuero', 'cinturones-cuero', 'Cinturones trenzados y lisos'),
('Porta Sombreros', 'porta-sombreros', 'Porta sombreros y accesorios');

-- Configuración inicial
INSERT INTO settings (key, value, category) VALUES
('company_name', '"Muy Criollo"', 'company'),
('company_email', '"admin@muycriollo.com"', 'company'),
('tax_condition', '"Responsable Inscripto"', 'billing'),
('invoice_types', '["A", "B"]', 'billing'),
('point_of_sale', '1', 'billing');

-- ============================================
-- HABILITAR ROW LEVEL SECURITY (opcional)
-- ============================================
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- (Descomentar cuando se implemente autenticación)
