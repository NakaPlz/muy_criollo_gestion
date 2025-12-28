// API Route para iniciar la autenticación con Mercado Libre
import { NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/src/lib/mercadolibre'

export async function GET() {
    try {
        const authUrl = getAuthorizationUrl()
        return NextResponse.redirect(authUrl)
    } catch (error) {
        console.error('Error generating ML auth URL:', error)
        return NextResponse.json(
            { error: 'Error iniciando autenticación con Mercado Libre' },
            { status: 500 }
        )
    }
}
