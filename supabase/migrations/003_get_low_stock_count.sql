-- Función para contar stock bajo dinámicamente
CREATE OR REPLACE FUNCTION get_low_stock_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM product_variants
        WHERE stock_quantity <= min_stock_alert
    );
END;
$$ LANGUAGE plpgsql;
