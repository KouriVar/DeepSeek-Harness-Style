// dsh-style — host half.
//
// The plugin is visually client-only: it registers a page in the native Harness
// Settings and applies reversible style toggles in the browser. This host entry
// exists only so the package is a normal DSH plugin with a profile entry; it
// declares no services and no configuration schema yet.
//
// Persistence for now lives in the browser (localStorage). A later version can
// move the values onto the host `settings` service by exporting a schemastery
// `Config` here and reading it through `ctx.configForms` on the client.

export const name = 'dsh-style'

export function apply() {}
