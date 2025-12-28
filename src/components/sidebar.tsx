"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingBag,
    Package,
    DollarSign,
    FileText,
    Users,
    BarChart3,
    Settings,
    LogOut
} from "lucide-react";
import { cn } from "@/src/lib/utils";

const menuItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Ventas", href: "/ventas", icon: ShoppingBag },
    { name: "Productos", href: "/productos", icon: Package },
    { name: "Precios", href: "/precios", icon: DollarSign },
    { name: "Facturación", href: "/facturacion", icon: FileText },
    { name: "Proveedores", href: "/proveedores", icon: Users },
    { name: "Competencia", href: "/competencia", icon: BarChart3 },
    { name: "Configuración", href: "/configuracion", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="sticky top-0 flex h-screen w-[250px] flex-col bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)] border-r border-[#333]">
            <div className="flex h-16 items-center px-6">
                <div className="flex items-center gap-2">
                    {/* Brand Logo Placeholder - Yellow Circle based on image */}
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-black font-bold text-xs">
                        MC
                    </div>
                    <span className="text-lg font-bold text-white">Muy Criollo</span>
                </div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-4">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)]"
                                    : "hover:bg-[#1f1f1f] text-[var(--sidebar-foreground)]"
                            )}
                        >
                            <item.icon className={cn("h-5 w-5", isActive ? "text-black" : "text-gray-400 group-hover:text-white")} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-[#333] p-4">
                <button className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--sidebar-foreground)] hover:bg-[#1f1f1f] transition-colors">
                    <div className="h-8 w-8 rounded-full bg-[var(--sidebar-active)] flex items-center justify-center text-black font-bold text-xs">A</div>
                    <div className="flex flex-col items-start">
                        <span className="text-xs font-semibold text-white">Muy Criollo</span>
                        <span className="text-[10px] text-gray-500">admin@muycriollo.com</span>
                    </div>
                </button>
            </div>
        </div>
    );
}
