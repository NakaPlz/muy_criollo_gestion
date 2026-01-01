"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit,
    Trash2,
    Package,
    AlertCircle
} from "lucide-react";
import { getProducts, getCategories, deleteProduct } from "@/src/lib/api";
import type { ProductWithRelations, Category } from "@/src/lib/types";
import { ProductModal } from "@/src/components/products/product-modal";

export default function ProductosPage() {
    const [products, setProducts] = useState<ProductWithRelations[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<ProductWithRelations | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [productsData, categoriesData] = await Promise.all([
                getProducts(),
                getCategories()
            ]);
            setProducts(productsData);
            setCategories(categoriesData);
        } catch (err) {
            setError("Error al cargar los productos");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        try {
            await deleteProduct(id);
            setProducts(products.filter(p => p.id !== id));
            setShowDeleteConfirm(null);
        } catch (err) {
            console.error("Error deleting product:", err);
        }
    }

    function handleEdit(product: ProductWithRelations) {
        setEditingProduct(product);
        setIsModalOpen(true);
    }

    function handleCreate() {
        setEditingProduct(null);
        setIsModalOpen(true);
    }

    function handleModalClose() {
        setIsModalOpen(false);
        setEditingProduct(null);
        loadData(); // Reload products
    }

    // Filter products
    const filteredProducts = products.filter(product => {
        const matchesSearch = searchQuery === "" ||
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.sku?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesCategory = selectedCategory === "" ||
            product.category_id === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    // Calculate total stock for a product
    function getTotalStock(product: ProductWithRelations): number {
        return product.variants?.reduce((sum, v) => sum + v.stock_quantity, 0) || 0;
    }

    // Check if product has low stock
    function hasLowStock(product: ProductWithRelations): boolean {
        return product.variants?.some(v => v.stock_quantity <= v.min_stock_alert) || false;
    }

    const [exporting, setExporting] = useState(false);

    async function handleExport() {
        try {
            if (!confirm("Se descargará el catálogo completo en CSV. ¿Continuar?")) return;
            setExporting(true);
            const res = await fetch('/api/products/export');
            if (!res.ok) throw new Error("Error en exportación");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `productos_mc_${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error(err);
            alert("Error al exportar productos");
        } finally {
            setExporting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Cargando productos...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-red-500">{error}</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Productos</h1>
                    <p className="text-muted-foreground">Gestiona tu catálogo de productos</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="btn btn-outline flex items-center gap-2"
                    >
                        {exporting ? (
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Package className="h-4 w-4" />
                        )}
                        {exporting ? "Exportando..." : "Exportar CSV"}
                    </button>
                    <button
                        onClick={handleCreate}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Producto
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="input w-auto min-w-[180px]"
                >
                    <option value="">Todas las categorías</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>

            {/* Products Table */}
            <div className="card overflow-hidden p-0">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-[#252525] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Producto
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Categoría
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                SKU
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Precio
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Stock
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Estado
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {filteredProducts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No se encontraron productos</p>
                                    <button
                                        onClick={handleCreate}
                                        className="mt-4 text-[var(--primary)] hover:underline"
                                    >
                                        Crear el primer producto
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            filteredProducts.map((product) => (
                                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-[#252525]">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-md bg-gray-100 dark:bg-[#333] flex items-center justify-center">
                                                {product.images?.[0] ? (
                                                    <img
                                                        src={product.images[0].url}
                                                        alt={product.name}
                                                        className="h-10 w-10 rounded-md object-cover"
                                                    />
                                                ) : (
                                                    <Package className="h-5 w-5 text-gray-400" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium">{product.name}</div>
                                                {product.variants && product.variants.length > 0 && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {product.variants.length} variante{product.variants.length > 1 ? 's' : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {product.category?.name || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono">
                                        {product.sku || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-medium">
                                        ${product.base_price.toLocaleString('es-AR')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {hasLowStock(product) && (
                                                <AlertCircle className="h-4 w-4 text-[var(--warning)]" />
                                            )}
                                            <span className={hasLowStock(product) ? "text-[var(--warning)]" : ""}>
                                                {getTotalStock(product)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex px-2 py-1 text-xs rounded-full ${product.is_active
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                            }`}>
                                            {product.is_active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(product)}
                                                className="p-2 hover:bg-gray-100 dark:hover:bg-[#333] rounded-md transition-colors"
                                                title="Editar"
                                            >
                                                <Edit className="h-4 w-4 text-gray-500" />
                                            </button>
                                            <button
                                                onClick={() => setShowDeleteConfirm(product.id)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </button>
                                        </div>

                                        {/* Delete Confirmation */}
                                        {showDeleteConfirm === product.id && (
                                            <div className="absolute right-6 mt-2 p-4 bg-white dark:bg-[#1C1C1C] rounded-lg shadow-lg border border-[var(--border)] z-10">
                                                <p className="text-sm mb-3">¿Eliminar este producto?</p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleDelete(product.id)}
                                                        className="btn text-xs py-1 px-3 bg-red-500 text-white hover:bg-red-600"
                                                    >
                                                        Eliminar
                                                    </button>
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(null)}
                                                        className="btn btn-outline text-xs py-1 px-3"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Summary */}
            <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{filteredProducts.filter(p => p.is_active).length} activo{filteredProducts.filter(p => p.is_active).length !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{filteredProducts.filter(p => hasLowStock(p)).length} con stock bajo</span>
            </div>

            {/* Product Modal */}
            {isModalOpen && (
                <ProductModal
                    product={editingProduct}
                    categories={categories}
                    onClose={handleModalClose}
                />
            )}
        </div>
    );
}
