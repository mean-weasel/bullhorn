import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Google Analytics Data API endpoint
const GA_DATA_API = 'https://analyticsdata.googleapis.com/v1beta'

// Token refresh endpoint
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

// 5 minute buffer before token expiration
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

interface TokenRefreshResult {
  accessToken: string
  tokenExpiresAt: string
}

async function refreshTokenIfNeeded(
  connection: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TokenRefreshResult> {
  const tokenExpiresAt = new Date(connection.token_expires_at as string)
  const now = new Date()

  // Check if token needs refresh (within 5 minutes of expiration)
  if (tokenExpiresAt.getTime() - now.getTime() > TOKEN_REFRESH_BUFFER_MS) {
    return {
      accessToken: connection.access_token as string,
      tokenExpiresAt: connection.token_expires_at as string,
    }
  }

  // Refresh the token
  const clientId = process.env.GOOGLE_ANALYTICS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ANALYTICS_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Google Analytics not configured')
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token as string,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenResponse.ok) {
    const errorData = await tokenResponse.json()
    console.error('Token refresh failed:', errorData)
    throw new Error('Failed to refresh access token')
  }

  const tokens = await tokenResponse.json()
  const newAccessToken = tokens.access_token
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Update the connection with new tokens
  await supabase
    .from('analytics_connections')
    .update({
      access_token: newAccessToken,
      token_expires_at: newExpiresAt,
    })
    .eq('id', connection.id)

  return {
    accessToken: newAccessToken,
    tokenExpiresAt: newExpiresAt,
  }
}

function getDateRangeFromPreset(preset: string): { startDate: string; endDate: string } {
  const endDate = new Date()
  const startDate = new Date()

  switch (preset) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7)
      break
    case '28d':
      startDate.setDate(endDate.getDate() - 28)
      break
    case '90d':
      startDate.setDate(endDate.getDate() - 90)
      break
    default:
      startDate.setDate(endDate.getDate() - 28) // default to 28 days
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  }
}

// GET /api/analytics/connections/[id]/report - Fetch metrics from GA4
// eslint-disable-next-line max-lines-per-function
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['analytics:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = await createClient()

    // Get the connection
    const { data: connection, error: connError } = await supabase
      .from('analytics_connections')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (connError || !connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Parse date range from query params
    const searchParams = request.nextUrl.searchParams
    const preset = searchParams.get('preset') || '28d'
    const customStartDate = searchParams.get('startDate')
    const customEndDate = searchParams.get('endDate')

    let dateRange: { startDate: string; endDate: string }
    if (customStartDate && customEndDate) {
      dateRange = { startDate: customStartDate, endDate: customEndDate }
    } else {
      dateRange = getDateRangeFromPreset(preset)
    }

    // Refresh token if needed
    const { accessToken } = await refreshTokenIfNeeded(connection, supabase)

    // Update sync status to syncing
    await supabase.from('analytics_connections').update({ sync_status: 'syncing' }).eq('id', id)

    // Fetch metrics from GA4 Data API
    const propertyId = connection.property_id
    const reportUrl = `${GA_DATA_API}/properties/${propertyId}:runReport`

    const reportResponse = await fetch(reportUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [dateRange],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'newUsers' },
          { name: 'totalUsers' },
          { name: 'eventCount' },
        ],
      }),
    })

    if (!reportResponse.ok) {
      const errorData = await reportResponse.json()
      console.error('GA4 API error:', errorData)

      // Update sync status to error
      await supabase
        .from('analytics_connections')
        .update({
          sync_status: 'error',
          sync_error: errorData.error?.message || 'Failed to fetch metrics',
        })
        .eq('id', id)

      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 502 })
    }

    const reportData = await reportResponse.json()

    // Parse metrics from response
    const row = reportData.rows?.[0]
    const metricValues = row?.metricValues || []

    const metrics = {
      activeUsers: parseInt(metricValues[0]?.value || '0', 10),
      sessions: parseInt(metricValues[1]?.value || '0', 10),
      pageViews: parseInt(metricValues[2]?.value || '0', 10),
      screenPageViews: parseInt(metricValues[2]?.value || '0', 10),
      engagementRate: parseFloat(metricValues[3]?.value || '0'),
      averageSessionDuration: parseFloat(metricValues[4]?.value || '0'),
      bounceRate: parseFloat(metricValues[5]?.value || '0'),
      newUsers: parseInt(metricValues[6]?.value || '0', 10),
      totalUsers: parseInt(metricValues[7]?.value || '0', 10),
      eventCount: parseInt(metricValues[8]?.value || '0', 10),
    }

    // Update sync status to success
    await supabase
      .from('analytics_connections')
      .update({
        sync_status: 'success',
        sync_error: null,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', id)

    const report = {
      connectionId: id,
      propertyId: connection.property_id,
      propertyName: connection.property_name,
      dateRange,
      metrics,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Error fetching analytics report:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics report' }, { status: 500 })
  }
}
