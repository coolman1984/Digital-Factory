# Anthropic TypeScript SDK (vendored)

`anthropic.iife.min.js` is `@anthropic-ai/sdk` 0.131.0 (MIT, see LICENSE) bundled once with esbuild so the site needs no build step.
It exposes `window.AnthropicSDK` with `Anthropic` (the client) and `betaTool` (JSON-Schema tool helper for the tool runner).

It is used only by the copilot's optional Claude mode. The viewer pastes their own API key; the key stays in that browser
(session storage unless they tick "remember") and requests go straight from the browser to the Anthropic API
(`dangerouslyAllowBrowser: true`). Without a key the copilot runs in local mode on the same tools.

Rebuild after changing `anthropic-entry.js`:

```bash
npm i @anthropic-ai/sdk@0.131.0 esbuild@0.24.0
npx esbuild anthropic-entry.js --bundle --minify --format=iife --global-name=AnthropicSDK --platform=browser --legal-comments=none --outfile=anthropic.iife.min.js
```
