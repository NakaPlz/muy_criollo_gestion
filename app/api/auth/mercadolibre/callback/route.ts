// API Route para recibir el callback de OAuth
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/src/lib/mercadolibre'
import { createClient } from '@/lib/supabase/server'

// Base URL para redirects - usar variable de entorno o hardcodear
function getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.ML_REDIRECT_URI?.replace('/api/auth/mercadolibre/callback', '') ||
        'https://omni-crm-muy-criollo-gestion.l55xrw.easypanel.host'
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const baseUrl = getBaseUrl()

    if (error) {
        console.error('ML Auth Error:', error)
        return NextResponse.redirect(`${baseUrl}/configuracion?ml_error=true`)
    }

    if (!code) {
        return NextResponse.redirect(`${baseUrl}/configuracion?ml_error=no_code`)
    }

    try {
        // Intercambiar código por tokens
        const tokens = await exchangeCodeForToken(code)

        // Guardar tokens en la base de datos
        const supabase = await createClient()

        // Primero intentamos actualizar si existe
        const { data: existing } = await supabase
            .from('settings')
            .select('id')
            .eq('key', 'ml_tokens')
            .single()

        const tokenData = JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            user_id: tokens.user_id,
            expires_at: Date.now() + (tokens.expires_in * 1000),
        })

        let dbError
        if (existing) {
            // Actualizar existente
            const result = await supabase
                .from('settings')
                .update({
                    value: tokenData,
                    updated_at: new Date().toISOString(),
                })
                .eq('key', 'ml_tokens')
            dbError = result.error
        } else {
            // Insertar nuevo
            const result = await supabase
                .from('settings')
                .insert({
                    key: 'ml_tokens',
                    value: tokenData,
                    category: 'integrations',
                    updated_at: new Date().toISOString(),
                })
            dbError = result.error
        }

        if (dbError) {
            console.error('Error saving ML tokens:', dbError)
            return NextResponse.redirect(`${baseUrl}/configuracion?ml_error=db&details=${encodeURIComponent(dbError.message)}`)
        }

        return NextResponse.redirect(`${baseUrl}/configuracion?ml_success=true`)
    } catch (err) {
        console.error('Error exchanging ML code:', err)
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        return NextResponse.redirect(`${baseUrl}/configuracion?ml_error=exchange&details=${encodeURIComponent(errorMsg)}`)
    }
}

// POST endpoint para recibir el código desde n8n o manualmente
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { code } = body

        if (!code) {
            return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
        }

        // Intercambiar código por tokens
        const tokens = await exchangeCodeForToken(code)

        // Guardar tokens en la base de datos
        const supabase = await createClient()

        // Primero intentamos actualizar si existe
        const { data: existing } = await supabase
            .from('settings')
            .select('id')
            .eq('key', 'ml_tokens')
            .single()

        const tokenData = JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            user_id: tokens.user_id,
            expires_at: Date.now() + (tokens.expires_in * 1000),
        })

        let dbError
        if (existing) {
            const result = await supabase
                .from('settings')
                .update({
                    value: tokenData,
                    updated_at: new Date().toISOString(),
                })
                .eq('key', 'ml_tokens')
            dbError = result.error
        } else {
            const result = await supabase
                .from('settings')
                .insert({
                    key: 'ml_tokens',
                    value: tokenData,
                    category: 'integrations',
                    updated_at: new Date().toISOString(),
                })
            dbError = result.error
        }

        if (dbError) {
            console.error('Error saving ML tokens:', dbError)
            return NextResponse.json({ error: 'Error guardando tokens', details: dbError.message }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            user_id: tokens.user_id,
            message: 'Mercado Libre conectado correctamente'
        })
    } catch (err) {
        console.error('Error processing ML callback:', err)
        return NextResponse.json({
            error: 'Error procesando autenticación',
            details: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500 })
    }
}
