/**
 * `server-only` throws by design outside a React Server Component graph, which
 * is exactly the guard we want in the app and exactly what breaks a Node test
 * runner. Vitest aliases the package to this empty module so server modules can
 * be unit tested; the real guard still applies to the Next build.
 */
export {}
