"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Search, ShoppingCart, User } from "lucide-react";
import {
    createSale,
    getNextSaleNumber,
    getProductVariantsWithProduct,
    searchCustomers,
    createCustomer
} from "@/src/lib/api";
import type {
    SaleChannel,
    ProductVariant,
    Product,
    Customer,
    CustomerInsert
} from "@/src/lib/types";

interface SaleModalProps {
    onClose: () => void;
}

interface SaleItemForm {
    product_variant_id: string;
    product_name: string;
    variant_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    max_stock: number;
}

type VariantWithProduct = ProductVariant & { product: Product };

export function SaleModal({ onClose }: SaleModalProps) {
    const [saleNumber, setSaleNumber] = useState<string>("");
    const [channel, setChannel] = useState<SaleChannel>("Presencial");
    const [paymentMethod, setPaymentMethod] = useState<string>("Efectivo");

    // Customer
    const [customerSearch, setCustomerSearch] = useState("");
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [newCustomer, setNewCustomer] = useState<CustomerInsert>({
        name: "",
        email: null,
        phone: null,
        document_type: null,
        document_number: null,
        tax_condition: "Consumidor Final",
        address: null,
        city: null,
        province: null,
        notes: null,
        source: null,
        ml_user_id: null
    });

    // Products
    const [variants, setVariants] = useState<VariantWithProduct[]>([]);
    const [items, setItems] = useState<SaleItemForm[]>([]);
    const [productSearch, setProductSearch] = useState("");

    // Totals
    const [discount, setDiscount] = useState(0);
    const [shippingCost, setShippingCost] = useState(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (customerSearch.length >= 2) {
            searchCustomersDebounced();
        } else {
            setCustomers([]);
        }
    }, [customerSearch]);

    async function loadInitialData() {
        try {
            const [nextNumber, variantsData] = await Promise.all([
                getNextSaleNumber(),
                getProductVariantsWithProduct()
            ]);
            setSaleNumber(nextNumber);
            setVariants(variantsData);
        } catch (err) {
            console.error("Error loading initial data:", err);
        }
    }

    async function searchCustomersDebounced() {
        try {
            const results = await searchCustomers(customerSearch);
            setCustomers(results);
        } catch (err) {
            console.error("Error searching customers:", err);
        }
    }

    function addItem(variant: VariantWithProduct) {
        const existingIndex = items.findIndex(i => i.product_variant_id === variant.id);

        if (existingIndex >= 0) {
            // Increment quantity if already exists
            const updatedItems = [...items];
            if (updatedItems[existingIndex].quantity < variant.stock_quantity) {
                updatedItems[existingIndex].quantity += 1;
                updatedItems[existingIndex].total_price =
                    updatedItems[existingIndex].quantity * updatedItems[existingIndex].unit_price;
                setItems(updatedItems);
            }
        } else {
            // Add new item
            const price = variant.product.base_price + variant.price_adjustment;
            setItems([...items, {
                product_variant_id: variant.id,
                product_name: variant.product.name,
                variant_name: variant.name,
                quantity: 1,
                unit_price: price,
                total_price: price,
                max_stock: variant.stock_quantity
            }]);
        }
        setProductSearch("");
    }

    function updateItemQuantity(index: number, quantity: number) {
        const updatedItems = [...items];
        const max = updatedItems[index].max_stock;
        const newQty = Math.min(Math.max(1, quantity), max);
        updatedItems[index].quantity = newQty;
        updatedItems[index].total_price = newQty * updatedItems[index].unit_price;
        setItems(updatedItems);
    }

    function removeItem(index: number) {
        setItems(items.filter((_, i) => i !== index));
    }

    function calculateSubtotal(): number {
        return items.reduce((sum, item) => sum + item.total_price, 0);
    }

    function calculateTotal(): number {
        return calculateSubtotal() - discount + shippingCost;
    }

    async function handleCreateCustomer() {
        try {
            const customer = await createCustomer({
                ...newCustomer,
                source: channel
            });
            setSelectedCustomer(customer);
            setShowCustomerForm(false);
            setCustomerSearch(customer.name);
        } catch (err) {
            console.error("Error creating customer:", err);
            setError("Error al crear el cliente");
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (items.length === 0) {
            setError("Debe agregar al menos un producto");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const saleData = {
                sale_number: saleNumber,
                channel,
                customer_id: selectedCustomer?.id || null,
                ml_order_id: null,
                status: 'completed' as const,
                subtotal: calculateSubtotal(),
                discount,
                shipping_cost: shippingCost,
                total: calculateTotal(),
                payment_method: paymentMethod,
                payment_status: 'paid' as const,
                notes: null
            };

            const saleItems = items.map(item => ({
                product_variant_id: item.product_variant_id,
                product_name: `${item.product_name} - ${item.variant_name}`,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price
            }));

            await createSale(saleData, saleItems);
            onClose();
        } catch (err) {
            console.error("Error creating sale:", err);
            setError("Error al registrar la venta");
        } finally {
            setLoading(false);
        }
    }

    const filteredVariants = variants.filter(v =>
        productSearch.length >= 2 && (
            v.product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            v.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            v.sku?.toLowerCase().includes(productSearch.toLowerCase())
        )
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />

            <div className="relative bg-white dark:bg-[#1C1C1C] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-xl font-semibold">Nueva Venta</h2>
                        <p className="text-sm text-muted-foreground">Nº {saleNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-[#333] rounded-md">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        {/* Channel & Payment */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Canal de Venta</label>
                                <select
                                    value={channel}
                                    onChange={(e) => setChannel(e.target.value as SaleChannel)}
                                    className="input"
                                    style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}
                                >
                                    <option value="Presencial" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Presencial</option>
                                    <option value="ML" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Mercado Libre</option>
                                    <option value="Instagram" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Instagram</option>
                                    <option value="WhatsApp" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>WhatsApp</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Método de Pago</label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="input"
                                    style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}
                                >
                                    <option value="Efectivo" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Efectivo</option>
                                    <option value="Transferencia" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Transferencia</option>
                                    <option value="Pago Online" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Pago Online</option>
                                    <option value="Tarjeta" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Tarjeta</option>
                                </select>
                            </div>
                        </div>

                        {/* Customer Section - Optional, collapsed by default */}
                        <div className="p-4 border border-[var(--border)] rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">Cliente</span>
                                    <span className="text-xs text-muted-foreground">(opcional)</span>
                                </div>
                                {!selectedCustomer && !showCustomerForm && (
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomerForm(true)}
                                        className="text-xs text-[var(--primary)] hover:underline"
                                    >
                                        + Agregar cliente
                                    </button>
                                )}
                            </div>

                            {showCustomerForm && (
                                <div className="mt-3 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <input
                                            type="text"
                                            placeholder="Nombre"
                                            value={newCustomer.name}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                            className="input text-sm"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Teléfono"
                                            value={newCustomer.phone || ""}
                                            onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                            className="input text-sm"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleCreateCustomer}
                                            className="btn btn-primary text-sm"
                                            disabled={!newCustomer.name}
                                        >
                                            Guardar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomerForm(false)}
                                            className="btn btn-outline text-sm"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedCustomer && (
                                <div className="mt-3 flex items-center justify-between p-2 bg-gray-50 dark:bg-[#252525] rounded-md">
                                    <div>
                                        <p className="font-medium">{selectedCustomer.name}</p>
                                        <p className="text-xs text-muted-foreground">{selectedCustomer.phone || 'Sin teléfono'}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedCustomer(null)}
                                        className="text-xs text-red-500 hover:underline"
                                    >
                                        Quitar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Products Section */}
                        <div className="p-4 border border-[var(--border)] rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Productos</span>
                            </div>

                            {/* Product Search */}
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="input pl-10 text-sm"
                                />
                                {filteredVariants.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-[#1C1C1C] border border-[var(--border)] rounded-md shadow-lg max-h-48 overflow-y-auto">
                                        {filteredVariants.map(v => (
                                            <button
                                                key={v.id}
                                                type="button"
                                                onClick={() => addItem(v)}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#333] text-sm flex justify-between items-center"
                                            >
                                                <div>
                                                    <p className="font-medium">{v.product.name}</p>
                                                    <p className="text-xs text-muted-foreground">{v.name} • Stock: {v.stock_quantity}</p>
                                                </div>
                                                <span className="font-bold">${(v.product.base_price + v.price_adjustment).toLocaleString('es-AR')}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            {items.length === 0 ? (
                                <p className="text-center text-muted-foreground text-sm py-4">
                                    Busca y agrega productos a la venta
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {items.map((item, index) => (
                                        <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-[#252525] rounded-md">
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{item.product_name}</p>
                                                <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                                    className="input w-16 text-center text-sm"
                                                    min="1"
                                                    max={item.max_stock}
                                                />
                                                <span className="text-sm font-bold w-24 text-right">
                                                    ${item.total_price.toLocaleString('es-AR')}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(index)}
                                                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Totals */}
                        {items.length > 0 && (
                            <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal</span>
                                    <span>${calculateSubtotal().toLocaleString('es-AR')}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span>Descuento</span>
                                    <div className="relative w-32">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                        <input
                                            type="number"
                                            value={discount}
                                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                                            className="input pl-6 text-sm text-right"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span>Envío</span>
                                    <div className="relative w-32">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                        <input
                                            type="number"
                                            value={shippingCost}
                                            onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                            className="input pl-6 text-sm text-right"
                                            min="0"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2 border-t border-[var(--border)]">
                                    <span>Total</span>
                                    <span>${calculateTotal().toLocaleString('es-AR')}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-gray-50 dark:bg-[#252525]">
                        <button type="button" onClick={onClose} className="btn btn-outline" disabled={loading}>
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || items.length === 0}
                        >
                            {loading ? "Registrando..." : "Registrar Venta"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
