<a href="https://npmjs.com/package/@vituum/vite-plugin-handlebars"><img src="https://img.shields.io/npm/v/@vituum/vite-plugin-handlebars.svg" alt="npm package"></a>
<a href="https://nodejs.org/en/about/releases/"><img src="https://img.shields.io/node/v/@vituum/vite-plugin-handlebars.svg" alt="node compatility"></a>

# ⚡️💡 ViteHandlebars

```js
import handlebars from '@vituum/vite-plugin-handlebars'

export default {
    plugins: [
        handlebars()
    ],
    build: {
        rollupOptions: {
            input: ['index.hbs.html']
        }
    }
}
```

* Read the [docs](https://vituum.dev/plugins/handlebars.html) to learn more about the plugin options.
* Use with [Vituum](https://vituum.dev) to get multi-page support.

## Basic usage

```html
<!-- index.hbs -->
{{> "path/to/template.hbs"}}
```
or
```html
<!-- index.json  -->
{
  "template": "path/to/template.hbs",
  "title": "Hello world"
}
```

### Requirements

- [Node.js LTS (16.x)](https://nodejs.org/en/download/)
- [Vite](https://vitejs.dev/)
