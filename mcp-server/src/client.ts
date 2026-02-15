/**
 * HTTP client for the Bullhorn API.
 * All requests are authenticated via Bearer API key.
 */

export class BullhornClient {
  private baseUrl: string
  private apiKey: string

  constructor() {
    const apiKey = process.env.BULLHORN_API_KEY
    if (!apiKey) {
      throw new Error(
        'BULLHORN_API_KEY is required. Create one at https://bullhorn.to/settings → API Keys.'
      )
    }
    this.apiKey = apiKey
    this.baseUrl = (process.env.BULLHORN_API_URL || 'https://bullhorn.to').replace(/\/$/, '')
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, string>
  ): Promise<T> {
    let url = `${this.baseUrl}/api${path}`
    if (params) {
      const search = new URLSearchParams(params)
      url += `?${search.toString()}`
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let message: string
      try {
        const json = JSON.parse(text)
        message = json.error || `HTTP ${res.status}`
      } catch {
        message = `HTTP ${res.status}: ${text.slice(0, 200)}`
      }
      throw new Error(message)
    }

    return res.json() as Promise<T>
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, params)
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  async patch<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}/api${path}`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let message: string
      try {
        const json = JSON.parse(text)
        message = json.error || `HTTP ${res.status}`
      } catch {
        message = `HTTP ${res.status}: ${text.slice(0, 200)}`
      }
      throw new Error(message)
    }

    return res.json() as Promise<T>
  }
}
