"use client";

import { useState } from "react";
import { X, Plus, Trash2, Package } from "lucide-react";
import { createProduct, updateProduct, createVariant, updateVariant, deleteVariant } from "@/src/lib/api";
import type { ProductWithRelations, Category, ProductInsert, ProductVariantInsert } from "@/src/lib/types";

interface ProductModalProps {
    product: ProductWithRelations | null;
    categories: Category[];
    onClose: () => void;
}

interface VariantFormData {
    id?: string;
    name: string;
    sku: string;
    price_adjustment: number;
    stock_quantity: number;
    min_stock_alert: number;
    isNew?: boolean;
    isDeleted?: boolean;
}

export function ProductModal({ product, categories, onClose }: ProductModalProps) {
    const isEditing = !!product;

    const [formData, setFormData] = useState({
        name: product?.name || "",
        description: product?.description || "",
        category_id: product?.category_id || "",
        base_price: product?.base_price || 0,
        cost_price: product?.cost_price || 0,
        sku: product?.sku || "",
        is_active: product?.is_active ?? true,
    });

    const [variants, setVariants] = useState<VariantFormData[]>(
        product?.variants?.map(v => ({
            id: v.id,
            name: v.name,
            sku: v.sku || "",
            price_adjustment: v.price_adjustment,
            stock_quantity: v.stock_quantity,
            min_stock_alert: v.min_stock_alert,
        })) || []
    );

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"general" | "variants">("general");

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const productData: ProductInsert = {
                name: formData.name,
                description: formData.description || null,
                category_id: formData.category_id || null,
                base_price: formData.base_price,
                cost_price: formData.cost_price,
                sku: formData.sku || null,
                is_active: formData.is_active,
            };

            let savedProduct;

            if (isEditing) {
                savedProduct = await updateProduct(product.id, productData);
            } else {
                savedProduct = await createProduct(productData);
            }

            // Handle variants
            for (const variant of variants) {
                if (variant.isDeleted && variant.id) {
                    await deleteVariant(variant.id);
                } else if (variant.isNew) {
                    const variantData: ProductVariantInsert = {
                        product_id: savedProduct.id,
                        name: variant.name,
                        sku: variant.sku || null,
                        price_adjustment: variant.price_adjustment,
                        stock_quantity: variant.stock_quantity,
                        min_stock_alert: variant.min_stock_alert,
                    };
                    await createVariant(variantData);
                } else if (variant.id) {
                    await updateVariant(variant.id, {
                        name: variant.name,
                        sku: variant.sku || null,
                        price_adjustment: variant.price_adjustment,
                        stock_quantity: variant.stock_quantity,
                        min_stock_alert: variant.min_stock_alert,
                    });
                }
            }

            onClose();
        } catch (err) {
            console.error("Error saving product:", err);
            setError("Error al guardar el producto");
        } finally {
            setLoading(false);
        }
    }

    function addVariant() {
        setVariants([
            ...variants,
            {
                name: "",
                sku: "",
                price_adjustment: 0,
                stock_quantity: 0,
                min_stock_alert: 5,
                isNew: true,
            },
        ]);
    }

    function removeVariant(index: number) {
        const variant = variants[index];
        if (variant.id) {
            // Mark existing variant for deletion
            setVariants(variants.map((v, i) =>
                i === index ? { ...v, isDeleted: true } : v
            ));
        } else {
            // Remove new variant from list
            setVariants(variants.filter((_, i) => i !== index));
        }
    }

    function updateVariantField(index: number, field: keyof VariantFormData, value: string | number) {
        setVariants(variants.map((v, i) =>
            i === index ? { ...v, [field]: value } : v
        ));
    }

    const activeVariants = variants.filter(v => !v.isDeleted);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-[#1C1C1C] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
                    <h2 className="text-xl font-semibold">
                        {isEditing ? "Editar Producto" : "Nuevo Producto"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-[#333] rounded-md transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-[var(--border)]">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "general"
                            ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab("variants")}
                        className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === "variants"
                            ? "border-b-2 border-[var(--primary)] text-[var(--primary)]"
                            : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        Variantes ({activeVariants.length})
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit}>
                    <div className="p-6 overflow-y-auto max-h-[60vh]">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-sm">
                                {error}
                            </div>
                        )}

                        {activeTab === "general" && (
                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Nombre <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="input"
                                        required
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Categoría</label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        className="input"
                                        style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}
                                    >
                                        <option value="" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Sin categoría</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id} style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Descripción</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="input min-h-[100px] resize-none"
                                        rows={4}
                                    />
                                </div>

                                {/* Prices */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Precio Base <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                            <input
                                                type="number"
                                                value={formData.base_price}
                                                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                                                className="input pl-7"
                                                min="0"
                                                step="0.01"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Costo</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                            <input
                                                type="number"
                                                value={formData.cost_price}
                                                onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                                                className="input pl-7"
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SKU */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">SKU</label>
                                    <input
                                        type="text"
                                        value={formData.sku}
                                        onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                        className="input font-mono"
                                        placeholder="PROD-001"
                                    />
                                </div>

                                {/* Active toggle */}
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <label htmlFor="is_active" className="text-sm">
                                        Producto activo
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === "variants" && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm text-muted-foreground">
                                        Agrega variantes para manejar diferentes talles, colores, etc.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={addVariant}
                                        className="btn btn-outline text-sm flex items-center gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Agregar
                                    </button>
                                </div>

                                {activeVariants.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground">
                                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                        <p>No hay variantes</p>
                                        <p className="text-sm">Agrega variantes para gestionar stock por separado</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {variants.map((variant, index) => !variant.isDeleted && (
                                            <div key={index} className="p-4 border border-[var(--border)] rounded-lg space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm font-medium text-muted-foreground">
                                                        Variante {index + 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeVariant(index)}
                                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">Nombre</label>
                                                        <input
                                                            type="text"
                                                            value={variant.name}
                                                            onChange={(e) => updateVariantField(index, "name", e.target.value)}
                                                            className="input text-sm"
                                                            placeholder="Talle M - Negro"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">SKU</label>
                                                        <input
                                                            type="text"
                                                            value={variant.sku}
                                                            onChange={(e) => updateVariantField(index, "sku", e.target.value)}
                                                            className="input text-sm font-mono"
                                                            placeholder="PROD-001-M-NEG"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">Ajuste precio</label>
                                                        <input
                                                            type="number"
                                                            value={variant.price_adjustment}
                                                            onChange={(e) => updateVariantField(index, "price_adjustment", parseFloat(e.target.value) || 0)}
                                                            className="input text-sm"
                                                            step="0.01"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium mb-1">Stock</label>
                                                        <input
                                                            type="number"
                                                            value={variant.stock_quantity}
                                                            onChange={(e) => updateVariantField(index, "stock_quantity", parseInt(e.target.value) || 0)}
                                                            className="input text-sm"
                                                            min="0"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <label className="block text-xs font-medium">Alerta Stock</label>
                                                            <input
                                                                type="checkbox"
                                                                checked={variant.min_stock_alert >= 0}
                                                                onChange={(e) => updateVariantField(index, "min_stock_alert", e.target.checked ? 5 : -1)}
                                                                title="Activar/Desactivar alerta"
                                                                className="h-3 w-3 rounded border-gray-300"
                                                            />
                                                        </div>
                                                        {variant.min_stock_alert >= 0 ? (
                                                            <input
                                                                type="number"
                                                                value={variant.min_stock_alert}
                                                                onChange={(e) => updateVariantField(index, "min_stock_alert", parseInt(e.target.value) || 0)}
                                                                className="input text-sm"
                                                                min="0"
                                                                placeholder="Mínimo"
                                                            />
                                                        ) : (
                                                            <div className="input text-sm bg-gray-100 dark:bg-gray-800 text-muted-foreground flex items-center justify-center">
                                                                <span className="text-xs">Desactivada</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--border)] bg-gray-50 dark:bg-[#252525]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-outline"
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                        >
                            {loading ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Producto"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
