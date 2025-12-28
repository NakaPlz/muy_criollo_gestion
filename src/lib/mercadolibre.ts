// Servicio para interactuar con la API de Mercado Libre
// Documentación: https://developers.mercadolibre.com.ar/es_ar/api-docs

const ML_API_URL = 'https://api.mercadolibre.com'
const ML_AUTH_URL = 'https://auth.mercadolibre.com.ar'

// Configuración desde variables de entorno
function getConfig() {
    return {
        clientId: process.env.ML_CLIENT_ID || '',
        clientSecret: process.env.ML_CLIENT_SECRET || '',
        redirectUri: process.env.ML_REDIRECT_URI || '',
    }
}

// ============================================
// AUTENTICACIÓN OAuth
// ============================================

/**
 * Genera la URL para iniciar el flujo de autorización OAuth
 */
export function getAuthorizationUrl(): string {
    const config = getConfig()
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
    })
    return `${ML_AUTH_URL}/authorization?${params.toString()}`
}

/**
 * Intercambia el código de autorización por tokens de acceso
 */
export async function exchangeCodeForToken(code: string): Promise<MLTokenResponse> {
    const config = getConfig()

    const response = await fetch(`${ML_API_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code: code,
            redirect_uri: config.redirectUri,
        }),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`ML Auth Error: ${error.message || response.statusText}`)
    }

    return response.json()
}

/**
 * Refresca el access token usando el refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<MLTokenResponse> {
    const config = getConfig()

    const response = await fetch(`${ML_API_URL}/oauth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken,
        }),
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(`ML Refresh Error: ${error.message || response.statusText}`)
    }

    return response.json()
}

// ============================================
// HELPERS
// ============================================

async function mlFetch<T>(endpoint: string, accessToken: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${ML_API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    })

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }))
        throw new Error(`ML API Error: ${error.message || response.statusText}`)
    }

    return response.json()
}

// ============================================
// USUARIO
// ============================================

/**
 * Obtiene información del usuario autenticado
 */
export async function getUser(accessToken: string): Promise<MLUser> {
    return mlFetch<MLUser>('/users/me', accessToken)
}

// ============================================
// ÓRDENES
// ============================================

/**
 * Obtiene las órdenes del vendedor
 */
export async function getOrders(accessToken: string, sellerId: string, options?: {
    offset?: number
    limit?: number
    status?: 'paid' | 'pending' | 'cancelled'
}): Promise<MLOrdersResponse> {
    const params = new URLSearchParams({
        seller: sellerId,
        offset: String(options?.offset || 0),
        limit: String(options?.limit || 50),
    })

    if (options?.status) {
        params.append('order.status', options.status)
    }

    return mlFetch<MLOrdersResponse>(`/orders/search?${params.toString()}`, accessToken)
}

/**
 * Obtiene una orden específica por ID
 */
export async function getOrder(accessToken: string, orderId: string): Promise<MLOrder> {
    return mlFetch<MLOrder>(`/orders/${orderId}`, accessToken)
}

/**
 * Obtiene las órdenes recientes (últimas 24 horas)
 */
export async function getRecentOrders(accessToken: string, sellerId: string): Promise<MLOrder[]> {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const params = new URLSearchParams({
        seller: sellerId,
        'order.date_created.from': yesterday.toISOString(),
        sort: 'date_desc',
    })

    const response = await mlFetch<MLOrdersResponse>(`/orders/search?${params.toString()}`, accessToken)
    return response.results
}

// ============================================
// ITEMS (PUBLICACIONES)
// ============================================

/**
 * Obtiene los items (publicaciones) del vendedor
 */
export async function getItems(accessToken: string, sellerId: string, options?: {
    offset?: number
    limit?: number
    status?: 'active' | 'paused' | 'closed'
}): Promise<MLItemsResponse> {
    const params = new URLSearchParams({
        seller_id: sellerId,
        offset: String(options?.offset || 0),
        limit: String(options?.limit || 50),
    })

    if (options?.status) {
        params.append('status', options.status)
    }

    return mlFetch<MLItemsResponse>(`/users/${sellerId}/items/search?${params.toString()}`, accessToken)
}

/**
 * Obtiene un item específico por ID
 */
export async function getItem(accessToken: string, itemId: string): Promise<MLItem> {
    return mlFetch<MLItem>(`/items/${itemId}`, accessToken)
}

/**
 * Actualiza el stock de un item
 */
export async function updateItemStock(accessToken: string, itemId: string, availableQuantity: number): Promise<MLItem> {
    return mlFetch<MLItem>(`/items/${itemId}`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ available_quantity: availableQuantity }),
    })
}

/**
 * Actualiza el precio de un item
 */
export async function updateItemPrice(accessToken: string, itemId: string, price: number): Promise<MLItem> {
    return mlFetch<MLItem>(`/items/${itemId}`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ price }),
    })
}

/**
 * Pausa o activa un item
 */
export async function updateItemStatus(accessToken: string, itemId: string, status: 'active' | 'paused'): Promise<MLItem> {
    return mlFetch<MLItem>(`/items/${itemId}`, accessToken, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    })
}

// ============================================
// TIPOS
// ============================================

export interface MLTokenResponse {
    access_token: string
    token_type: string
    expires_in: number
    scope: string
    user_id: number
    refresh_token: string
}

export interface MLUser {
    id: number
    nickname: string
    first_name: string
    last_name: string
    email: string
    site_id: string
    seller_reputation?: {
        level_id: string
        power_seller_status: string | null
        transactions: {
            completed: number
            canceled: number
        }
    }
}

export interface MLOrder {
    id: number
    status: string
    status_detail: string | null
    date_created: string
    date_closed: string | null
    order_items: MLOrderItem[]
    total_amount: number
    currency_id: string
    buyer: {
        id: number
        nickname: string
        first_name: string
        last_name: string
        email: string
    }
    shipping?: {
        id: number
        status: string
    }
    payments: MLPayment[]
}

export interface MLOrderItem {
    item: {
        id: string
        title: string
        seller_sku: string | null
        variation_id: number | null
    }
    quantity: number
    unit_price: number
    full_unit_price: number
    currency_id: string
}

export interface MLPayment {
    id: number
    status: string
    status_detail: string
    payment_type: string
    payment_method_id: string
    total_paid_amount: number
    transaction_amount: number
}

export interface MLOrdersResponse {
    query: string
    results: MLOrder[]
    paging: {
        total: number
        offset: number
        limit: number
    }
}

export interface MLItem {
    id: string
    title: string
    category_id: string
    price: number
    currency_id: string
    available_quantity: number
    sold_quantity: number
    status: string
    permalink: string
    thumbnail: string
    pictures: { id: string; url: string }[]
    seller_sku?: string
    variations?: MLVariation[]
}

export interface MLVariation {
    id: number
    price: number
    available_quantity: number
    sold_quantity: number
    seller_custom_field?: string
    attribute_combinations: {
        id: string
        name: string
        value_id: string
        value_name: string
    }[]
}

export interface MLItemsResponse {
    seller_id: string
    results: string[]
    paging: {
        total: number
        offset: number
        limit: number
    }
}
