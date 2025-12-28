"use client";

import { Search, Bell } from "lucide-react";

export function Header() {
    return (
        <header className="flex h-16 items-center justify-between border-b bg-[var(--background)] px-6">
            <div className="flex flex-1 items-center">
                <div className="relative w-full max-w-md">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar productos, ventas, clientes..."
                        className="h-10 w-full rounded-md border-0 bg-gray-100 pl-10 pr-4 text-sm text-[var(--foreground)] focus:ring-2 focus:ring-[var(--ring)] dark:bg-[#1C1C1C] dark:text-white"
                    />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button className="relative rounded-full p-2 hover:bg-gray-100 dark:hover:bg-[#1C1C1C]">
                    <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black" />
                </button>
            </div>
        </header>
    );
}
