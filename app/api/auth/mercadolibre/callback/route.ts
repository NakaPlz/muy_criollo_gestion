// API Route para recibir el callback de OAuth (cuando se usa desde la app)
// Nota: En producción, el callback va a n8n que luego llama a esta API
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCodeForToken } from '@/src/lib/mercadolibre'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
        console.error('ML Auth Error:', error)
        return NextResponse.redirect(new URL('/configuracion?ml_error=true', request.url))
    }

    if (!code) {
        return NextResponse.redirect(new URL('/configuracion?ml_error=no_code', request.url))
    }

    try {
        // Intercambiar código por tokens
        const tokens = await exchangeCodeForToken(code)

        // Guardar tokens en la base de datos
        const supabase = await createClient()

        const { error: dbError } = await supabase
            .from('settings')
            .upsert({
                key: 'ml_tokens',
                value: JSON.stringify({
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    user_id: tokens.user_id,
                    expires_at: Date.now() + (tokens.expires_in * 1000),
                }),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'key'
            })

        if (dbError) {
            console.error('Error saving ML tokens:', dbError)
            return NextResponse.redirect(new URL('/configuracion?ml_error=db', request.url))
        }

        return NextResponse.redirect(new URL('/configuracion?ml_success=true', request.url))
    } catch (err) {
        console.error('Error exchanging ML code:', err)
        return NextResponse.redirect(new URL('/configuracion?ml_error=exchange', request.url))
    }
}

// POST endpoint para recibir el código desde n8n
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

        const { error: dbError } = await supabase
            .from('settings')
            .upsert({
                key: 'ml_tokens',
                value: JSON.stringify({
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    user_id: tokens.user_id,
                    expires_at: Date.now() + (tokens.expires_in * 1000),
                }),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'key'
            })

        if (dbError) {
            console.error('Error saving ML tokens:', dbError)
            return NextResponse.json({ error: 'Error guardando tokens' }, { status: 500 })
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
