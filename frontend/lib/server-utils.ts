import { auth } from "@clerk/nextjs/server"

export const getAuthToken = async () => {
  try {
    return (await (await auth()).getToken()) ?? undefined
  } catch (err) {}
}

/**
 * The function fetchWithAuth fetches data from a URL with authentication using a bearer token.
 * @note This function must be used in a Server Component or API route.
 * @param {string} url - The `url` parameter is a string that represents the URL of the resource you
 * want to fetch data from.
 * @param {RequestInit} options - The `options` parameter in the `fetchWithAuth` function is of type
 * `RequestInit`, which is an interface that represents a set of configurable options to control the
 * behavior of a fetch request. It includes properties like `method`, `headers`, `body`, `mode`,
 * `cache`, `
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getAuthToken()
  const headers = new Headers(options.headers)
  if (token) {
    headers.append("Authorization", `Bearer ${token}`)
  }
  return fetch(url, {
    ...options,
    headers,
  })
}
