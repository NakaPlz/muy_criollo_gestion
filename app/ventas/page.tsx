"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    Search,
    ShoppingCart,
    Eye,
    DollarSign,
    CheckCircle,
    Clock,
    XCircle,
    RefreshCw
} from "lucide-react";
import { getSales, updateSaleStatus, updatePaymentStatus } from "@/src/lib/api";
import type { SaleWithRelations, SaleChannel, SaleStatus, PaymentStatus } from "@/src/lib/types";
import { SaleModal } from "@/src/components/sales/sale-modal";

const channelLabels: Record<SaleChannel, { label: string; color: string }> = {
    'ML': { label: 'Mercado Libre', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    'Instagram': { label: 'Instagram', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400' },
    'WhatsApp': { label: 'WhatsApp', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    'Presencial': { label: 'Presencial', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};

const statusLabels: Record<SaleStatus, { label: string; icon: typeof Clock; color: string }> = {
    'pending': { label: 'Pendiente', icon: Clock, color: 'text-yellow-500' },
    'processing': { label: 'En Proceso', icon: RefreshCw, color: 'text-blue-500' },
    'completed': { label: 'Completado', icon: CheckCircle, color: 'text-green-500' },
    'cancelled': { label: 'Cancelado', icon: XCircle, color: 'text-red-500' },
};

const paymentStatusLabels: Record<PaymentStatus, { label: string; color: string }> = {
    'pending': { label: 'Pendiente', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    'paid': { label: 'Pagado', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    'refunded': { label: 'Reembolsado', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400' },
};

export default function VentasPage() {
    const [sales, setSales] = useState<SaleWithRelations[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedChannel, setSelectedChannel] = useState<string>("");
    const [selectedStatus, setSelectedStatus] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadSales();
    }, []);

    async function loadSales() {
        try {
            setLoading(true);
            const data = await getSales();
            setSales(data);
        } catch (err) {
            setError("Error al cargar las ventas");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    function handleModalClose() {
        setIsModalOpen(false);
        loadSales();
    }

    // Filter sales
    const filteredSales = sales.filter(sale => {
        const matchesSearch = searchQuery === "" ||
            sale.sale_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.customer?.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesChannel = selectedChannel === "" || sale.channel === selectedChannel;
        const matchesStatus = selectedStatus === "" || sale.status === selectedStatus;

        return matchesSearch && matchesChannel && matchesStatus;
    });

    // Calculate totals
    const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const paidSales = filteredSales.filter(s => s.payment_status === 'paid').length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">Cargando ventas...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Ventas</h1>
                    <p className="text-muted-foreground">Registra y gestiona tus ventas</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Nueva Venta
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-[var(--primary)]/10 rounded-md">
                            <ShoppingCart className="h-5 w-5 text-[var(--primary)]" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Ventas</p>
                            <p className="text-xl font-bold">{filteredSales.length}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-md">
                            <DollarSign className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Monto Total</p>
                            <p className="text-xl font-bold">${totalSales.toLocaleString('es-AR')}</p>
                        </div>
                    </div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/10 rounded-md">
                            <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pagadas</p>
                            <p className="text-xl font-bold">{paidSales} / {filteredSales.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por número o cliente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="input pl-10"
                    />
                </div>
                <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="input w-auto min-w-[150px]"
                    style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}
                >
                    <option value="" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Todos los canales</option>
                    <option value="ML" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Mercado Libre</option>
                    <option value="Instagram" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Instagram</option>
                    <option value="WhatsApp" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>WhatsApp</option>
                    <option value="Presencial" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Presencial</option>
                </select>
                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="input w-auto min-w-[150px]"
                    style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}
                >
                    <option value="" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Todos los estados</option>
                    <option value="pending" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Pendiente</option>
                    <option value="processing" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>En Proceso</option>
                    <option value="completed" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Completado</option>
                    <option value="cancelled" style={{ backgroundColor: '#1C1C1C', color: '#EDEDED' }}>Cancelado</option>
                </select>
            </div>

            {/* Sales Table */}
            <div className="card overflow-hidden p-0">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-[#252525] border-b border-[var(--border)]">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Nº Venta
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Cliente
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Canal
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Productos
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Total
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Estado
                            </th>
                            <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Pago
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Fecha
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                        {filteredSales.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                    <p>No se encontraron ventas</p>
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="mt-4 text-[var(--primary)] hover:underline"
                                    >
                                        Registrar primera venta
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            filteredSales.map((sale) => {
                                const StatusIcon = statusLabels[sale.status].icon;
                                return (
                                    <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-[#252525]">
                                        <td className="px-6 py-4 font-mono text-sm font-medium">
                                            {sale.sale_number}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {sale.customer?.name || 'Sin cliente'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const channelInfo = channelLabels[sale.channel] || {
                                                    label: sale.channel,
                                                    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                                };
                                                return (
                                                    <span className={`inline-flex px-2 py-1 text-xs rounded-full ${channelInfo.color}`}>
                                                        {channelInfo.label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {sale.items?.length || 0} item{sale.items?.length !== 1 ? 's' : ''}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-right font-bold">
                                            ${sale.total.toLocaleString('es-AR')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className={`flex items-center justify-center gap-1 ${statusLabels[sale.status].color}`}>
                                                <StatusIcon className="h-4 w-4" />
                                                <span className="text-xs">{statusLabels[sale.status].label}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex px-2 py-1 text-xs rounded-full ${paymentStatusLabels[sale.payment_status].color}`}>
                                                {paymentStatusLabels[sale.payment_status].label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-muted-foreground">
                                            {new Date(sale.created_at).toLocaleDateString('es-AR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Sale Modal */}
            {isModalOpen && (
                <SaleModal onClose={handleModalClose} />
            )}
        </div>
    );
}
