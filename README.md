<a href="https://npmjs.com/package/@vituum/vite-plugin-handlebars"><img src="https://img.shields.io/npm/v/@vituum/vite-plugin-handlebars.svg" alt="npm package"></a>
<a href="https://nodejs.org/en/about/releases/"><img src="https://img.shields.io/node/v/@vituum/vite-plugin-handlebars.svg" alt="node compatility"></a>

# ⚡️💡 ViteHandlebars

```js
export default {
  plugins: [
    handlebars({
      filters: {},
      functions: {},
      extensions: [],
      namespaces: {}, 
      data: '*.json',
      globals: {
          template: 'path/to/template.hbs'
      },
      filetypes: {
          html: /.(json.html|hbs.json.html|hbs.html)$/,
          json: /.(json.hbs.html)$/
      }
    })
  ]
}
```

```html
<!-- index.html -->
<script type="application/json" data-format="hbs">
  {
    "template": "path/to/template.hbs",
    "title": "Hello world"
  }
</script>
```
or
```html
<!-- index.hbs.html -->
{{title}}
```
or
```html
<!-- index.json.html or index.hbs.json.html  -->
{
  "template": "path/to/template.hbs",
  "title": "Hello world"
}
```

### Requirements

- [Node.js LTS (16.x)](https://nodejs.org/en/download/)
