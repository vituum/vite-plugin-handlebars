import { dirname, extname, resolve, relative } from 'path'
import fs from 'fs'
import process from 'node:process'
import FastGlob from 'fast-glob'
import lodash from 'lodash'
import Handlebars from 'handlebars'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

const { name } = JSON.parse(fs.readFileSync(resolve(dirname((fileURLToPath(import.meta.url))), 'package.json')).toString())
const defaultOptions = {
    helpers: {},
    globals: {},
    partials: {
        directory: null,
        extname: false
    },
    data: '',
    filetypes: {
        html: /.(json.html|hbs.json.html|hbs.html)$/,
        json: /.(json.hbs.html)$/
    },
    compileOptions: {},
    runtimeOptions: {}
}

function processData(paths, data = {}) {
    let context = {}

    lodash.merge(context, data)

    FastGlob.sync(paths).forEach(entry => {
        const path = resolve(process.cwd(), entry)

        context = lodash.merge(context, JSON.parse(fs.readFileSync(path).toString()))
    })

    return context
}

const renderTemplate = async(filename, content, options) => {
    const output = {}
    const context = processData(options.data, options.globals)

    if (
        filename.endsWith('.json.html') ||
        filename.endsWith('.json')
    ) {
        lodash.merge(context, JSON.parse(fs.readFileSync(filename).toString()))

        content = `{{> (lookup @root 'template')}}`

        context.template = relative(process.cwd(), context.template)
    } else if (fs.existsSync(filename + '.json')) {
        lodash.merge(context, JSON.parse(fs.readFileSync(filename + '.json').toString()))
    }

    const partialGlob = !options.partials.directory ? `${options.root}/**/*.hbs` : `${resolve(process.cwd(), options.partials.directory)}/**/*.hbs`

    FastGlob.sync(partialGlob).map(entry => resolve(process.cwd(), entry)).forEach((path) => {
        const partialDir = options.partials.directory ? relative(process.cwd(), options.partials.directory) : options.root
        const partialName = relative(partialDir, path)

        Handlebars.registerPartial(options.partials.extname ? partialName : partialName.replace('.hbs',''), fs.readFileSync(path).toString())
    })

    if (options.helpers) {
        Object.keys(options.helpers).forEach((helper) => {
            Handlebars.registerHelper(helper, options.helpers[helper])
        })
    }

    try {
        const template = Handlebars.compile(content, options.compileOptions)

        output.content = template(context, options.runtimeOptions)
    } catch(error) {
        output.error = error
    }

    return output
}

const plugin = (options = {}) => {
    options = lodash.merge(defaultOptions, options)

    return {
        name,
        config: ({ root }) => {
            options.root = root
        },
        transformIndexHtml: {
            enforce: 'pre',
            async transform(content, { path, filename, server }) {
                if (
                    !options.filetypes.html.test(path) &&
                    !options.filetypes.json.test(path) &&
                    !content.startsWith('<script type="application/json"')
                ) {
                    return content
                }

                if (content.startsWith('<script type="application/json"') && !content.includes('data-format="hbs"')) {
                    return content
                }

                const render = await renderTemplate(filename, content, options)

                if (render.error) {
                    if (!server) {
                        console.error(chalk.red(render.error))
                        return
                    }

                    server.ws.send({
                        type: 'error',
                        err: {
                            message: render.error.message,
                            plugin: name
                        }
                    })

                    return '<html style="background: #222"><head></head><body></body></html>'
                }

                return render.content
            }
        },
        handleHotUpdate({ file, server }) {
            if (extname(file) === '.hbs' || extname(file) === '.html' || extname(file) === '.json') {
                server.ws.send({ type: 'full-reload' })
            }
        }
    }
}

export default plugin
