
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

// Configuración de colores
const COLOR_MAP: Record<string, string> = {
    'TO': 'Tostado',
    'NA': 'Natural',
    'BO': 'Bordo',
    'MA': 'Marron',
    'NE': 'Negro',
    'VE': 'Verde',
    'RO': 'Rojo',
    'AZ': 'Azul',
    'BL': 'Blanco',
    'GR': 'Gris',
    'VI': 'Violeta',
    'VIO': 'Violeta',
    'NAR': 'Naranja',
    'BE': 'Beige',
    'GO': 'Gris Oscuro'
}

export async function POST() {
    try {
        const supabase = await createClient()

        // 1. Leer archivo CSV
        const csvPath = path.join(process.cwd(), 'Ventas Historicas MC.csv')
        const fileContent = fs.readFileSync(csvPath, 'utf-8')

        const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            from_line: 2,
            bom: true
        }) as any[]

        // 2. Obtener variantes para matchmaking
        const { data: variants } = await supabase
            .from('product_variants')
            .select('id, sku, name, product_id')

        // Mapa de SKU -> Variant ID para búsqueda rápida
        // Asumimos SKU format: "MODELO-COLOR-TALLE" o similar. 
        // El usuario dijo: "combinacion de columas de modelo, color y talle"
        // Intentaremos construir el SKU y buscar match.

        let processedCount = 0
        let successCount = 0
        let skippedCount = 0 // Por ser de antes de 2022 o sin producto
        let errorCount = 0

        // Lógica de Fechas
        let currentYear = 2022
        let lastMonth = 3 // Abril es 3 (base 0) - Empezamos en Abril 2022

        // El CSV empieza en Abril. Si detectamos un mes MENOR al anterior (ej Dic -> Ene), sumamos año.
        // Ojo: El CSV parece estar ordenado cronológicamente?
        // Fila 2: 17-abr (2022)
        // ...
        // Fila 280: 01-ene -> Aquí cambia de año a 2023

        const monthMap: Record<string, number> = {
            'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
        }

        // Agrupamos items en ventas (mismo día y cliente/origen podría ser una venta, pero el CSV parece linea por venta?)
        // Mirando el CSV: "Fecha, Origen...". 
        // Si hay varias lineas con misma fecha y cliente, ¿es una venta? 
        // El CSV tiene col "Cant.". Parece que cada fila es un Item de venta.
        // O una venta con un solo item.
        // Asumiremos 1 Fila = 1 Venta para simplificar, a menos que sea obvio agrupar.
        // Dado que no hay "ID de Venta", crearé una venta por fila.

        for (const row of records) {
            processedCount++

            // --- PARSEO DE FECHA ---
            const fechaStr = row['Fecha'] // "17-abr"
            if (!fechaStr || fechaStr === '-') continue

            const parts = fechaStr.split('-')
            if (parts.length < 2) continue

            const dayStr = parts[0]
            const monthStr = parts[1]

            const day = parseInt(dayStr)
            const month = monthMap[monthStr.toLowerCase()]

            if (month === undefined) continue // Fecha invalida

            // Detectar cambio de año
            // Si pasamos de Dic (11) a Ene (0), o de un mes mayor a uno menor drásticamente, incrementamos año.
            // Pero cuidado con datos desordenados. Asumimos orden cronológico como dijo el user.
            // Ajuste fino: Si bajamos de mes (ej 11 -> 0), año++

            if (month < lastMonth && (lastMonth - month) > 6) {
                currentYear++
            }
            lastMonth = month

            const saleDate = new Date(currentYear, month, day)

            // --- FILTRADO DE PRODUCTOS ---
            // "Quiero que las ventas que sean de productos que no estan subidos al stock, no se le seleccione un producto"
            // SKU Construction: Modelo + Color + Talle
            // Color mapping
            const colorCode = row['Color']?.toUpperCase().trim() || ''
            const mappedColor = COLOR_MAP[colorCode] || colorCode // Usar nombre completo si existe map, sino el código

            // Construir posibles SKUs para match
            // Formatos posibles: "MODELO-COLOR_CODE-TALLE", "MODELO", etc.
            // Mirando el CSV: Modelo="AULM080CEF", Color="MA", Talle="S"
            // Posible SKU: "AULM080CEF-MA-S" o "AULM080CEF-MARRON-S"

            const modelo = row['Modelo']?.trim()
            const talle = row['Talle']?.trim()

            if (!modelo) continue // Sin modelo, skippear o guardar genérico? User dijo solo si está en stock.

            // Intentar encontrar variant
            let foundVariant = null

            // Estrategia 1: Match Exacto de SKU construido (suponiendo convención)
            // Probemos variaciones comunes
            const candidates = [
                `${modelo}-${colorCode}-${talle}`,
                `${modelo}-${talle}-${colorCode}`,
                `${modelo}-${colorCode}`,
                `${modelo}`
            ]

            // Buscar en DB
            // Como variants es un array en memoria (pequeño?), iteramos.
            foundVariant = variants?.find(v => candidates.includes(v.sku)) || null

            // Estrategia 2: Fuzzy match o "Primer color disponible"
            if (!foundVariant && modelo) {
                // Buscar por SKU que empiece con el modelo
                const potentialMatches = variants?.filter(v => v.sku?.startsWith(modelo))
                if (potentialMatches && potentialMatches.length > 0) {
                    // Si el user dijo "si no hay color, el primero", aplicamos esa lógica
                    // Tratamos de matchear Talle al menos
                    if (talle) {
                        foundVariant = potentialMatches.find(v => v.sku?.includes(talle))
                    }
                    if (!foundVariant) {
                        // "selecciona el primero que aparezca como opcion"
                        foundVariant = potentialMatches[0]
                    }
                }
            }

            // Si NO está en stock (no foundVariant), el usuario dijo: "no se le seleccione un producto"
            // Pero "Nos gustaria tener informacion de que producto se vendio".
            // Entonces creamos la venta IGUAL, pero con `product_variant_id: null` y ponemos el nombre en `product_name`.

            // --- VALORES MONETARIOS ---
            // "Venta" column: "10.999,00" -> 10999.00
            const parseMoney = (str: string) => {
                if (!str) return 0
                // Eliminar puntos de miles, reemplazar coma decimal por punto
                // "10.999,00" -> "10999.00"
                // "8.861,51" -> "8861.51"
                let clean = str.replace(/\./g, '').replace(',', '.')
                return parseFloat(clean) || 0
            }

            const total = parseMoney(row['Venta'])
            const quantity = parseInt(row['Cant.']) || 1
            const unitPrice = total / quantity // Aproximado si total es por todo

            // --- INSERTAR VENTA ---
            const { data: sale, error: saleError } = await supabase
                .from('sales')
                .insert({
                    sale_number: `HIST-${processedCount}`, // ID único para histórico
                    channel: mapChannel(row['Origen']),
                    status: 'completed',
                    payment_status: 'paid',
                    total: total,
                    subtotal: total,
                    created_at: saleDate.toISOString(),
                    updated_at: saleDate.toISOString(),
                    notes: `Importado Histórico. Orig: ${row['Origen']}. Ganancia Est: ${row['Ganancia']}`
                })
                .select()
                .single()

            if (saleError) {
                console.error('Error creating sale:', saleError)
                errorCount++
                continue
            }

            // --- INSERTAR ITEM ---
            await supabase
                .from('sale_items')
                .insert({
                    sale_id: sale.id,
                    product_variant_id: foundVariant ? foundVariant.id : null,
                    product_name: foundVariant ? foundVariant.name : `${modelo} ${colorCode} ${talle}`.trim(),
                    quantity: quantity,
                    unit_price: unitPrice,
                    total_price: total
                })

            successCount++
        }

        return NextResponse.json({
            success: true,
            processed: processedCount,
            imported: successCount,
            errors: errorCount,
            debug_sample: records.length > 0 ? Object.keys(records[0]) : 'No records'
        })

    } catch (error) {
        console.error('Import error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

function mapChannel(origin: string): string {
    const o = origin?.toLowerCase() || ''
    if (o.includes('ml') || o.includes('mercadolibre')) return 'Mercado Libre'
    if (o.includes('local')) return 'Presencial'
    if (o.includes('ig') || o.includes('instagram')) return 'Instagram'
    if (o.includes('johnny')) return 'Presencial' // Asumimos vendedor presencial
    return 'Presencial' // Default
}
