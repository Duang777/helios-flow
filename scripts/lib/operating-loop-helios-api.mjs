export async function readHttpJson(response, label) {
  const text = await response.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`[operating-loop-helios-api] ${label} expected JSON, got ${text.slice(0, 500)}`)
  }
  if (!response.ok) {
    throw new Error(
      `[operating-loop-helios-api] ${label} failed (${response.status}): ${JSON.stringify(json).slice(0, 800)}`,
    )
  }
  return json
}

export async function loginHelios(appUrl, email, password) {
  const form = new URLSearchParams()
  form.set('email', email)
  form.set('password', password)
  const response = await fetch(`${appUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json = await readHttpJson(response, 'helios.login')
  if (typeof json?.token !== 'string') {
    throw new Error('[operating-loop-helios-api] Helios login response did not include token')
  }
  return json.token
}

export function readTokenContext(token) {
  const parts = String(token).split('.')
  if (parts.length < 2) throw new Error('[operating-loop-helios-api] Helios token is not a JWT')
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  return {
    organizationId: payload.orgId ?? '',
    tenantId: payload.tenantId ?? '',
    userId: payload.sub ?? payload.userId ?? '',
  }
}

export function createHeliosApi(appUrl, token) {
  return async function api(path, init = {}) {
    const response = await fetch(`${appUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    })
    return readHttpJson(response, `${init.method ?? 'GET'} ${path}`)
  }
}

export async function listAll(api, path, options = {}) {
  const pageSize = options.pageSize ?? 100
  const items = []
  let page = 1
  const stableSort = options.stableSort ?? true
  while (true) {
    const separator = path.includes('?') ? '&' : '?'
    const sortQuery = stableSort ? '&sortField=createdAt&sortDir=asc' : ''
    const payload = await api(`${path}${separator}page=${page}&pageSize=${pageSize}${sortQuery}`)
    const pageItems = Array.isArray(payload?.items) ? payload.items : []
    items.push(...pageItems)
    if (pageItems.length < pageSize || (payload?.totalPages && page >= payload.totalPages)) break
    page += 1
  }
  return items
}
