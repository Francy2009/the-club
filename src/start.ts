import { createMiddleware, createStart } from '@tanstack/react-start'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function configuredOrigins() {
  return (process.env.APP_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

function isAllowedOrigin(origin: string, request: Request) {
  const requestOrigin = new URL(request.url).origin
  return origin === requestOrigin || configuredOrigins().includes(origin)
}

const csrfMiddleware = createMiddleware().server(async ({ next, request }) => {
  if (!SAFE_METHODS.has(request.method.toUpperCase())) {
    const origin = request.headers.get('origin')
    const fetchSite = request.headers.get('sec-fetch-site')

    if (origin) {
      let validOrigin = false
      try {
        validOrigin = isAllowedOrigin(new URL(origin).origin, request)
      } catch {
        validOrigin = false
      }

      if (!validOrigin) {
        throw new Error('Richiesta respinta: origine non valida')
      }
    } else if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      throw new Error('Richiesta respinta: origine non valida')
    }
  }

  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
}))
