import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Google Analytics Admin API endpoint
const GA_ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'

// GET /api/analytics/properties - List available GA4 properties
// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Look up access token from DB using connectionId query param
    const connectionId = request.nextUrl.searchParams.get('connectionId')
    if (!connectionId) {
      return NextResponse.json({ error: 'connectionId query param required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: connection, error: dbError } = await supabase
      .from('analytics_connections')
      .select('access_token')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single()

    if (dbError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    const accessToken = connection.access_token

    // Fetch accounts first
    const accountsResponse = await fetch(`${GA_ADMIN_API}/accounts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.json()
      console.error('GA Admin API accounts error:', errorData)
      return NextResponse.json(
        { error: 'Failed to fetch Google Analytics accounts' },
        { status: 502 }
      )
    }

    const accountsData = await accountsResponse.json()
    const accounts = accountsData.accounts || []

    // Fetch properties for each account
    const allProperties: Array<{
      propertyId: string
      displayName: string
      accountName: string
      timeZone?: string
      currencyCode?: string
    }> = []

    for (const account of accounts) {
      const accountName = account.displayName || account.name

      // List properties for this account
      const propertiesResponse = await fetch(`${GA_ADMIN_API}/${account.name}/properties`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (propertiesResponse.ok) {
        const propertiesData = await propertiesResponse.json()
        const properties = propertiesData.properties || []

        for (const property of properties) {
          // Extract property ID from resource name (e.g., "properties/123456789")
          const propertyIdMatch = property.name?.match(/properties\/(\d+)/)
          const propertyId = propertyIdMatch ? propertyIdMatch[1] : property.name

          allProperties.push({
            propertyId,
            displayName: property.displayName || `Property ${propertyId}`,
            accountName,
            timeZone: property.timeZone,
            currencyCode: property.currencyCode,
          })
        }
      }
    }

    // If no properties found via accounts, try direct property listing
    if (allProperties.length === 0) {
      const directPropertiesResponse = await fetch(`${GA_ADMIN_API}/properties`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (directPropertiesResponse.ok) {
        const propertiesData = await directPropertiesResponse.json()
        const properties = propertiesData.properties || []

        for (const property of properties) {
          const propertyIdMatch = property.name?.match(/properties\/(\d+)/)
          const propertyId = propertyIdMatch ? propertyIdMatch[1] : property.name

          allProperties.push({
            propertyId,
            displayName: property.displayName || `Property ${propertyId}`,
            accountName: 'Default Account',
            timeZone: property.timeZone,
            currencyCode: property.currencyCode,
          })
        }
      }
    }

    return NextResponse.json({ properties: allProperties })
  } catch (error) {
    console.error('Error fetching GA4 properties:', error)
    return NextResponse.json({ error: 'Failed to fetch GA4 properties' }, { status: 500 })
  }
}
