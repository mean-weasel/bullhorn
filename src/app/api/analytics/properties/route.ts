import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Google Analytics Admin API endpoint
const GA_ADMIN_API = 'https://analyticsadmin.googleapis.com/v1beta'

interface GaProperty {
  propertyId: string
  displayName: string
  accountName: string
  timeZone?: string
  currencyCode?: string
}

function extractPropertyId(name: string) {
  const match = name?.match(/properties\/(\d+)/)
  return match ? match[1] : name
}

function mapProperties(
  properties: Array<Record<string, string>>,
  accountName: string
): GaProperty[] {
  return properties.map((property) => ({
    propertyId: extractPropertyId(property.name),
    displayName: property.displayName || `Property ${extractPropertyId(property.name)}`,
    accountName,
    timeZone: property.timeZone,
    currencyCode: property.currencyCode,
  }))
}

async function fetchAllGaProperties(accessToken: string): Promise<GaProperty[]> {
  const accountsResponse = await fetch(`${GA_ADMIN_API}/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!accountsResponse.ok) {
    const errorData = await accountsResponse.json()
    console.error('GA Admin API accounts error:', errorData)
    throw new Error('Failed to fetch Google Analytics accounts')
  }

  const accountsData = await accountsResponse.json()
  const accounts = accountsData.accounts || []
  const allProperties: GaProperty[] = []

  for (const account of accounts) {
    const accountName = account.displayName || account.name
    const propertiesResponse = await fetch(`${GA_ADMIN_API}/${account.name}/properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (propertiesResponse.ok) {
      const propertiesData = await propertiesResponse.json()
      allProperties.push(...mapProperties(propertiesData.properties || [], accountName))
    }
  }

  if (allProperties.length === 0) {
    const directResponse = await fetch(`${GA_ADMIN_API}/properties`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (directResponse.ok) {
      const propertiesData = await directResponse.json()
      allProperties.push(...mapProperties(propertiesData.properties || [], 'Default Account'))
    }
  }

  return allProperties
}

// GET /api/analytics/properties - List available GA4 properties
export async function GET(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const allProperties = await fetchAllGaProperties(connection.access_token)
    return NextResponse.json({ properties: allProperties })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error('Error fetching GA4 properties:', error)
    return NextResponse.json({ error: 'Failed to fetch GA4 properties' }, { status: 500 })
  }
}
