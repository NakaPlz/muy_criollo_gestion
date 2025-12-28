"use client";

import { useEffect, useState } from "react";
import {
    RefreshCw,
    Check,
    X,
    Link2,
    ExternalLink,
    Package,
    AlertCircle,
    Loader2,
    Download,
    Plus,
    ChevronDown
} from "lucide-react";

interface MLItem {
    id: string;
    title: string;
    price: number;
    available_quantity: number;
    sold_quantity: number;
    status: string;
    permalink: string;
    thumbnail: string;
    seller_sku: string | null;
}

interface LinkedItem {
    id: string;
    product_variant_id: string;
    external_id: string;
    stock_synced: number;
    last_sync_at: string;
    status: string;
    product_variant: {
        id: string;
        name: string;
        sku: string | null;
        stock_quantity: number;
        product: { name: string };
    };
}

interface StockData {
    ml_items: MLItem[];
    linked_items: LinkedItem[];
    total_ml_items: number;
}

export default function ConfiguracionPage() {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [importing, setImporting] = useState<string | null>(null);
    const [data, setData] = useState<StockData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mlConnected, setMlConnected] = useState(false);
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch('/api/mercadolibre/stock');
            const json = await res.json();

            if (json.needsAuth) {
                setMlConnected(false);
            } else if (json.error) {
                setError(json.error);
            } else {
                setMlConnected(true);
                setData(json);
            }
        } catch (err) {
            setError('Error cargando datos');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function syncAllStock() {
        try {
            setSyncing(true);
            const res = await fetch('/api/mercadolibre/stock', { method: 'PUT' });
            const json = await res.json();

            if (json.success) {
                alert(`✅ Sincronizados ${json.synced} items`);
                loadData();
            } else {
                alert(`❌ Error: ${json.error}`);
            }
        } catch (err) {
            alert('Error sincronizando stock');
        } finally {
            setSyncing(false);
        }
    }

    async function importItem(mlItemId: string) {
        try {
            setImporting(mlItemId);
            const res = await fetch('/api/mercadolibre/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ml_item_id: mlItemId }),
            });
            const json = await res.json();

            if (json.success) {
                alert(`✅ ${json.message}`);
                loadData();
            } else {
                alert(`❌ Error: ${json.error}`);
            }
        } catch (err) {
            alert('Error importando producto');
        } finally {
            setImporting(null);
        }
    }

    function isItemLinked(mlItemId: string): boolean {
        return data?.linked_items.some(item => item.external_id === mlItemId) || false;
    }

    function toggleProduct(productName: string) {
        setExpandedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productName)) {
                newSet.delete(productName);
            } else {
                newSet.add(productName);
            }
            return newSet;
        });
    }

    // Agrupar items vinculados por producto
    function getGroupedLinkedItems() {
        if (!data?.linked_items) return {};

        const grouped: Record<string, LinkedItem[]> = {};
        for (const item of data.linked_items) {
            const productName = item.product_variant?.product?.name || 'Sin producto';
            if (!grouped[productName]) {
                grouped[productName] = [];
            }
            grouped[productName].push(item);
        }
        return grouped;
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold">Configuración</h1>
                    <p className="text-muted-foreground">Integraciones y sincronización</p>
                </div>
            </div>

            {/* ML Connection Status */}
            <div className="card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${mlConnected ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {mlConnected ? (
                                <Check className="h-6 w-6 text-green-500" />
                            ) : (
                                <X className="h-6 w-6 text-red-500" />
                            )}
                        </div>
                        <div>
                            <h3 className="font-semibold">Mercado Libre</h3>
                            <p className="text-sm text-muted-foreground">
                                {mlConnected ? 'Conectado y funcionando' : 'No conectado'}
                            </p>
                        </div>
                    </div>

                    {!mlConnected ? (
                        <a
                            href="/api/auth/mercadolibre"
                            className="btn btn-primary"
                        >
                            Conectar ML
                        </a>
                    ) : (
                        <button
                            onClick={loadData}
                            className="btn btn-outline"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Actualizar
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    {error}
                </div>
            )}

            {/* Stock Sync Section */}
            {mlConnected && data && (
                <>
                    {/* Stats */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="card">
                            <div className="flex items-center gap-3">
                                <Package className="h-5 w-5 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Items en ML</p>
                                    <p className="text-xl font-bold">{data.total_ml_items}</p>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="flex items-center gap-3">
                                <Link2 className="h-5 w-5 text-green-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Vinculados</p>
                                    <p className="text-xl font-bold">{data.linked_items.length}</p>
                                </div>
                            </div>
                        </div>
                        <div className="card">
                            <div className="flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-500" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Sin Vincular</p>
                                    <p className="text-xl font-bold">{data.ml_items.length - data.linked_items.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sync All Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={syncAllStock}
                            disabled={syncing || data.linked_items.length === 0}
                            className="btn btn-primary"
                        >
                            {syncing ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            Sincronizar Todo el Stock
                        </button>
                    </div>

                    {/* Linked Items */}
                    <div className="card">
                        <h3 className="font-semibold mb-4">Productos Vinculados</h3>

                        {data.linked_items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No hay productos vinculados todavía</p>
                                <p className="text-sm mt-2">Vinculá tus variantes con items de ML para sincronizar stock</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(getGroupedLinkedItems()).map(([productName, variants]) => {
                                    const isExpanded = expandedProducts.has(productName);
                                    const totalStock = variants.reduce((sum, v) => sum + (v.product_variant?.stock_quantity || 0), 0);
                                    const allSynced = variants.every(v => v.stock_synced === v.product_variant?.stock_quantity);

                                    return (
                                        <div key={productName} className="border border-[var(--border)] rounded-lg overflow-hidden">
                                            {/* Header del producto - clickeable */}
                                            <button
                                                onClick={() => toggleProduct(productName)}
                                                className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-[#252525] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <ChevronDown
                                                        className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    />
                                                    <div className="text-left">
                                                        <p className="font-medium">{productName}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {variants.length} variante{variants.length > 1 ? 's' : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <p className="text-sm">Stock total: <span className="font-bold">{totalStock}</span></p>
                                                    </div>
                                                    <div className={`p-1 rounded ${allSynced ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                                                        {allSynced ? (
                                                            <Check className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                                                        )}
                                                    </div>
                                                </div>
                                            </button>

                                            {/* Variantes expandidas */}
                                            {isExpanded && (
                                                <div className="border-t border-[var(--border)]">
                                                    {variants.map((item) => {
                                                        const stockMatch = item.stock_synced === item.product_variant?.stock_quantity;
                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className="flex items-center justify-between p-3 pl-10 border-b border-[var(--border)] last:border-b-0"
                                                            >
                                                                <div>
                                                                    <p className="text-sm">{item.product_variant?.name}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {item.product_variant?.sku && `SKU: ${item.product_variant.sku}`}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <div className="text-right">
                                                                        <p className="text-sm">
                                                                            <span className="font-bold">{item.product_variant?.stock_quantity}</span>
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            ML: {item.stock_synced}
                                                                        </p>
                                                                    </div>
                                                                    <div className={`w-2 h-2 rounded-full ${stockMatch ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ML Items */}
                    <div className="card">
                        <h3 className="font-semibold mb-4">Items en Mercado Libre</h3>

                        {data.ml_items.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>No se encontraron items activos en ML</p>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {data.ml_items.map((item) => {
                                    const linked = isItemLinked(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            className={`flex items-start gap-3 p-3 border rounded-md ${linked ? 'border-green-500/50 bg-green-500/5' : 'border-[var(--border)]'}`}
                                        >
                                            {item.thumbnail && (
                                                <img
                                                    src={item.thumbnail}
                                                    alt={item.title}
                                                    className="w-16 h-16 object-cover rounded"
                                                />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-medium text-sm truncate flex-1">{item.title}</p>
                                                    {linked ? (
                                                        <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded flex items-center gap-1">
                                                            <Check className="h-3 w-3" /> Vinculado
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => importItem(item.id)}
                                                            disabled={importing === item.id}
                                                            className="text-xs bg-[var(--primary)] text-black px-2 py-1 rounded flex items-center gap-1 hover:opacity-80 disabled:opacity-50"
                                                        >
                                                            {importing === item.id ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : (
                                                                <Plus className="h-3 w-3" />
                                                            )}
                                                            Importar
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Stock: <span className="font-bold">{item.available_quantity}</span>
                                                    {' · '}
                                                    Vendidos: {item.sold_quantity}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs font-mono bg-gray-100 dark:bg-[#333] px-1.5 py-0.5 rounded">
                                                        {item.id}
                                                    </span>
                                                    <a
                                                        href={item.permalink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
                                                    >
                                                        Ver <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
