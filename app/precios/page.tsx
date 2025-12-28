"use client";

import { useEffect, useState } from "react";
import {
    Search,
    DollarSign,
    Percent,
    Save,
    X,
    Edit2,
    TrendingUp
} from "lucide-react";
import { getProducts, updateProduct, updateVariant } from "@/src/lib/api";
import type { ProductWithRelations, ProductVariant } from "@/src/lib/types";

export default function PreciosPage() {
    const [products, setProducts] = useState<ProductWithRelations[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [editingPrice, setEditingPrice] = useState<{ id: string; type: 'product' | 'variant'; field: 'base_price' | 'cost_price' | 'price_adjustment' } | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadProducts();
    }, []);

    async function loadProducts() {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
        } catch (err) {
            console.error("Error loading products:", err);
        } finally {
            setLoading(false);
        }
    }

    function startEditing(id: string, type: 'product' | 'variant', field: 'base_price' | 'cost_price' | 'price_adjustment', currentValue: number) {
        setEditingPrice({ id, type, field });
        setEditValue(currentValue);
    }

    function cancelEditing() {
        setEditingPrice(null);
        setEditValue(0);
    }

    async function savePrice() {
        if (!editingPrice) return;

        setSaving(true);
        try {
            if (editingPrice.type === 'product') {
                await updateProduct(editingPrice.id, { [editingPrice.field]: editValue });
            } else {
                await updateVariant(editingPrice.id, { [editingPrice.field]: editValue });
            }
            await loadProducts();
            cancelEditing();
        } catch (err) {
            console.error("Error saving price:", err);
        } finally {
            setSaving(false);
        }
    }

    function calculateMargin(price: number, cost: number): number {
        if (cost === 0) return 100;
        return ((price - cost) / price) * 100;
    }

    // Filter products
    const filteredProducts = products.filter(product => {
        return searchQuery === "" ||
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Calculate stats
    const avgMargin = products.length > 0
        ? products.reduce((sum, p) => sum + calculateMargin(p.base_price, p.cost_price), 0) / products.length
        : 0;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Cargando precios...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold">Precios</h1>
                <p className="text-muted-foreground">Gestiona los precios de tus productos</p>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--primary)]/10 rounded-md">
                            <DollarSign className="h-5 w-5 text-[var(--primary)]" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Productos</p>
                            <p className="text-xl font-bold">{products.length}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-md">
                            <Percent className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Margen Promedio</p>
                            <p className="text-xl font-bold">{avgMargin.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-md">
                            <TrendingUp className="h-5 w-5 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Con Variantes</p>
                            <p className="text-xl font-bold">{products.filter(p => p.variants && p.variants.length > 0).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input pl-10"
                />
            </div>

            {/* Prices Table */}
            <div className="card overflow-hidden p-0">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-[#252525] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Producto
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Costo
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Precio
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Margen
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No se encontraron productos</p>
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((product) => {
                                const margin = calculateMargin(product.base_price, product.cost_price);
                                const hasVariants = product.variants && product.variants.length > 0;

                                return (
                                    <>
                                        {/* Product Row */}
                                        <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-[#252525]">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <div className="font-medium">{product.name}</div>
                                                    {product.sku && (
                                                        <div className="text-xs text-muted-foreground font-mono">{product.sku}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {editingPrice?.id === product.id && editingPrice.field === 'cost_price' ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                                                            className="input w-28 text-right text-sm"
                                                            autoFocus
                                                        />
                                                        <button onClick={savePrice} disabled={saving} className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded">
                                                            <Save className="h-4 w-4 text-green-500" />
                                                        </button>
                                                        <button onClick={cancelEditing} className="p-1 hover:bg-gray-100 dark:hover:bg-[#333] rounded">
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEditing(product.id, 'product', 'cost_price', product.cost_price)}
                                                        className="group flex items-center justify-end gap-2 hover:text-[var(--primary)]"
                                                    >
                                                        <span className="text-sm">${product.cost_price.toLocaleString('es-AR')}</span>
                                                        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {editingPrice?.id === product.id && editingPrice.field === 'base_price' ? (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <input
                                                            type="number"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                                                            className="input w-28 text-right text-sm"
                                                            autoFocus
                                                        />
                                                        <button onClick={savePrice} disabled={saving} className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded">
                                                            <Save className="h-4 w-4 text-green-500" />
                                                        </button>
                                                        <button onClick={cancelEditing} className="p-1 hover:bg-gray-100 dark:hover:bg-[#333] rounded">
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => startEditing(product.id, 'product', 'base_price', product.base_price)}
                                                        className="group flex items-center justify-end gap-2 hover:text-[var(--primary)] font-bold"
                                                    >
                                                        <span>${product.base_price.toLocaleString('es-AR')}</span>
                                                        <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-sm font-medium ${margin >= 30 ? 'text-green-500' :
                                                        margin >= 15 ? 'text-yellow-500' :
                                                            'text-red-500'
                                                    }`}>
                                                    {margin.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Variants Rows */}
                                        {hasVariants && product.variants?.map((variant) => {
                                            const variantPrice = product.base_price + variant.price_adjustment;
                                            const variantMargin = calculateMargin(variantPrice, product.cost_price);

                                            return (
                                                <tr key={variant.id} className="bg-gray-25 dark:bg-[#1a1a1a] hover:bg-gray-50 dark:hover:bg-[#252525]">
                                                    <td className="px-6 py-3 pl-12">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-muted-foreground">↳</span>
                                                            <span className="text-sm">{variant.name}</span>
                                                            {variant.sku && (
                                                                <span className="text-xs text-muted-foreground font-mono">({variant.sku})</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right text-sm text-muted-foreground">
                                                        -
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        {editingPrice?.id === variant.id && editingPrice.field === 'price_adjustment' ? (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <span className="text-xs text-muted-foreground">Ajuste:</span>
                                                                <input
                                                                    type="number"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
                                                                    className="input w-24 text-right text-sm"
                                                                    autoFocus
                                                                />
                                                                <button onClick={savePrice} disabled={saving} className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded">
                                                                    <Save className="h-4 w-4 text-green-500" />
                                                                </button>
                                                                <button onClick={cancelEditing} className="p-1 hover:bg-gray-100 dark:hover:bg-[#333] rounded">
                                                                    <X className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => startEditing(variant.id, 'variant', 'price_adjustment', variant.price_adjustment)}
                                                                className="group flex items-center justify-end gap-2 hover:text-[var(--primary)]"
                                                            >
                                                                <span className="text-sm">
                                                                    ${variantPrice.toLocaleString('es-AR')}
                                                                    {variant.price_adjustment !== 0 && (
                                                                        <span className={`ml-1 text-xs ${variant.price_adjustment > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                            ({variant.price_adjustment > 0 ? '+' : ''}{variant.price_adjustment})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                                <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className={`text-xs ${variantMargin >= 30 ? 'text-green-500' :
                                                                variantMargin >= 15 ? 'text-yellow-500' :
                                                                    'text-red-500'
                                                            }`}>
                                                            {variantMargin.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Legend */}
            <div className="flex gap-6 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500"></span>
                    <span>Margen ≥30%</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    <span>Margen 15-30%</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    <span>Margen &lt;15%</span>
                </div>
            </div>
        </div>
    );
}
