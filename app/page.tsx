"use client";

import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Package,
  DollarSign,
  AlertCircle
} from "lucide-react";
import { StatsCard } from "@/src/components/dashboard/stats-card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  getDashboardStats,
  getRecentSales,
  getSalesEvolution,
  getLowStockVariants,
  type DashboardStats
} from "@/src/lib/api";
import type { SaleWithRelations, ProductVariant } from "@/src/lib/types";

const channelLabels: Record<string, string> = {
  'ML': 'Mercado Libre',
  'Instagram': 'Instagram',
  'WhatsApp': 'WhatsApp',
  'Presencial': 'Presencial',
};

const statusLabels: Record<string, { label: string; color: string }> = {
  'pending': { label: 'Pendiente', color: 'bg-white border border-gray-200 text-gray-600 dark:bg-[#333] dark:border-none dark:text-gray-300' },
  'processing': { label: 'En Proceso', color: 'bg-black text-white dark:bg-white dark:text-black' },
  'completed': { label: 'Completado', color: 'bg-[var(--primary)] text-black' },
  'cancelled': { label: 'Cancelado', color: 'bg-red-500 text-white' },
};

type LowStockVariant = ProductVariant & { product: { name: string } };

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<SaleWithRelations[]>([]);
  const [salesEvolution, setSalesEvolution] = useState<{ month: string; total: number }[]>([]);
  const [lowStock, setLowStock] = useState<LowStockVariant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [statsData, salesData, evolutionData, stockData] = await Promise.all([
        getDashboardStats(),
        getRecentSales(5),
        getSalesEvolution(6),
        getLowStockVariants()
      ]);
      setStats(statsData);
      setRecentSales(salesData);
      setSalesEvolution(evolutionData);
      setLowStock(stockData);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(value: number): string {
    return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Vista general de tu negocio en tiempo real</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Ventas del Mes"
          value={formatCurrency(stats?.totalSalesMonth || 0)}
          change={`${stats?.totalSalesCount || 0} ventas`}
          changeType="positive"
          icon={ShoppingCart}
          trend="up"
        />
        <StatsCard
          title="Órdenes Pendientes"
          value={String(stats?.pendingOrders || 0)}
          change="Requieren atención"
          changeType={stats?.pendingOrders ? "warning" : "positive"}
          icon={Package}
        />
        <StatsCard
          title="Ticket Promedio"
          value={formatCurrency(stats?.averageTicket || 0)}
          change="Este mes"
          changeType="positive"
          icon={DollarSign}
        />
        <StatsCard
          title="Stock Bajo"
          value={String(stats?.lowStockCount || 0)}
          change={stats?.lowStockCount ? "Requiere atención" : "Todo en orden"}
          changeType={stats?.lowStockCount ? "warning" : "positive"}
          icon={AlertCircle}
        />
      </div>

      {/* Charts & Stock Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Sales Chart */}
        <div className="card h-[400px]">
          <h3 className="font-semibold mb-1">Evolución de Ventas</h3>
          <p className="text-sm text-muted-foreground mb-4">Últimos 6 meses de ventas en ARS</p>
          <div className="h-[300px] w-full">
            {salesEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesEvolution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    stroke="var(--foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
                    formatter={(value: number) => [formatCurrency(value), 'Total']}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--primary)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No hay datos de ventas
              </div>
            )}
          </div>
        </div>

        {/* Stock Status */}
        <div className="card h-[400px] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold">Estado de Stock</h3>
              <p className="text-sm text-muted-foreground">Productos con stock bajo</p>
            </div>
          </div>

          <div className="space-y-6">
            {lowStock.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-50" />
                <p>Todo el stock está en orden</p>
              </div>
            ) : (
              lowStock.map((item) => {
                const percentage = Math.min((item.stock_quantity / (item.min_stock_alert * 2)) * 100, 100);
                const status = item.stock_quantity <= 0 ? 'Agotado' :
                  item.stock_quantity <= item.min_stock_alert ? 'Crítico' : 'Bajo';
                const statusColor = status === 'Agotado' ? 'bg-[var(--danger)] text-white' :
                  status === 'Crítico' ? 'bg-orange-500 text-white' :
                    'bg-[var(--primary)] text-black';
                const barColor = status === 'Agotado' ? 'bg-[var(--danger)]' :
                  status === 'Crítico' ? 'bg-orange-400' :
                    'bg-[var(--primary)]';
                return (
                  <div key={item.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <div>
                        <span className="font-medium">{item.product?.name}</span>
                        <span className="text-muted-foreground ml-2">({item.name})</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-bold">{item.stock_quantity}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColor}`}>{status}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-[#333]">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card">
        <h3 className="font-semibold mb-1">Órdenes Recientes</h3>
        <p className="text-sm text-muted-foreground mb-4">Últimas ventas registradas</p>

        <div className="space-y-4">
          {recentSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
              <p>No hay ventas registradas</p>
            </div>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-[#252525] rounded-md">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{sale.customer?.name || 'Venta Anónima'}</span>
                    <span className="text-[10px] bg-white dark:bg-[#333] border border-gray-200 dark:border-none px-1.5 rounded">
                      {channelLabels[sale.channel] || sale.channel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sale.items?.map(i => i.product_name).join(', ') || sale.sale_number}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">{formatCurrency(sale.total)}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusLabels[sale.status]?.color || ''}`}>
                    {statusLabels[sale.status]?.label || sale.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
