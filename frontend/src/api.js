const API_BASE = window.__OPENFANG_BASE__ || ''

function readStoredApiKey() {
  try {
    return window.localStorage.getItem('openfang-api-key') || ''
  } catch {
    return ''
  }
}

function buildWebSocketUrl(path) {
  const baseUrl = new URL(API_BASE || '/', window.location.origin)
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}${path}`
  return baseUrl
}

export async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json()
}

export async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json()
}

export async function apiPut(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json()
}

export async function apiDel(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(await readError(response))
  }
  return response.json()
}

export function openAgentSocket(agentId, callbacks = {}, options = {}) {
  const maxReconnectAttempts = options.maxReconnectAttempts ?? 5
  let socket = null
  let reconnectAttempts = 0
  let reconnectTimer = null
  let closedManually = false
  let pendingConnect = null

  function clearReconnectTimer() {
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function rejectPendingConnect(error) {
    if (pendingConnect) {
      pendingConnect.reject(error)
      pendingConnect = null
    }
  }

  function connect() {
    if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
      return pendingConnect?.promise || Promise.resolve()
    }

    clearReconnectTimer()
    closedManually = false

    pendingConnect = {}
    pendingConnect.promise = new Promise((resolve, reject) => {
      pendingConnect.resolve = resolve
      pendingConnect.reject = reject
    })

    const url = buildWebSocketUrl(`/api/agents/${encodeURIComponent(agentId)}/ws`)
    const authToken = readStoredApiKey()
    if (authToken) {
      url.searchParams.set('token', authToken)
    }

    socket = new WebSocket(url.toString())

    socket.onopen = () => {
      reconnectAttempts = 0
      callbacks.onOpen?.()
      pendingConnect?.resolve()
      pendingConnect = null
    }

    socket.onmessage = (event) => {
      try {
        callbacks.onMessage?.(JSON.parse(event.data))
      } catch {
        callbacks.onMessageRaw?.(event.data)
      }
    }

    socket.onerror = (event) => {
      callbacks.onError?.(event)
    }

    socket.onclose = (event) => {
      socket = null
      const shouldReconnect =
        !closedManually && reconnectAttempts < maxReconnectAttempts

      rejectPendingConnect(new Error('WebSocket closed before connection was ready'))
      callbacks.onClose?.(event, { willReconnect: shouldReconnect })

      if (!shouldReconnect) {
        return
      }

      reconnectAttempts += 1
      const delayMs = Math.min(1000 * (2 ** (reconnectAttempts - 1)), 10000)
      reconnectTimer = window.setTimeout(() => {
        void connect()
      }, delayMs)
    }

    return pendingConnect.promise
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false
    }
    socket.send(JSON.stringify(payload))
    return true
  }

  function close() {
    closedManually = true
    clearReconnectTimer()
    if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
      socket.close(1000, 'client closed')
    }
    socket = null
    rejectPendingConnect(new Error('WebSocket closed by client'))
  }

  function isOpen() {
    return Boolean(socket && socket.readyState === WebSocket.OPEN)
  }

  return {
    close,
    connect,
    isOpen,
    send,
  }
}

async function readError(response) {
  try {
    const data = await response.json()
    return data.error || response.statusText
  } catch {
    return response.statusText
  }
}
