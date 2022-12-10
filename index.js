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
    reload: true,
    root: null,
    helpers: {},
    globals: {},
    partials: {
        directory: null,
        extname: true
    },
    data: '',
    filetypes: {
        html: /.(json.html|hbs.json.html|hbs.html)$/,
        json: /.(json.hbs.html)$/
    },
    handlebars: {
        compileOptions: {},
        runtimeOptions: {}
    }
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
    const context = options.data ? processData(options.data, options.globals) : options.globals

    const isJson = filename.endsWith('.json.html') || filename.endsWith('.json')
    const isHtml = filename.endsWith('.html') && !options.filetypes.html.test(filename) && !options.filetypes.json.test(filename) && !isJson

    if (isJson || isHtml) {
        lodash.merge(context, JSON.parse(fs.readFileSync(filename).toString()))

        content = `{{> (lookup @root 'template')}}`

        if (typeof context.template === 'undefined') {
            console.error(chalk.red(name + ' template must be defined - ' + filename))
        }

        context.template = relative(process.cwd(), context.template).startsWith(relative(process.cwd(), options.root)) ? resolve(process.cwd(), context.template) : resolve(options.root, context.template)

        context.template = relative(options.root, context.template)
    } else if (fs.existsSync(filename + '.json')) {
        lodash.merge(context, JSON.parse(fs.readFileSync(filename + '.json').toString()))
    }

    const partialGlob = !options.partials.directory ? `${options.root}/**/*.hbs` : `${resolve(process.cwd(), options.partials.directory)}/**/*.hbs`

    FastGlob.sync(partialGlob).map(entry => resolve(process.cwd(), entry)).forEach((path) => {
        const partialDir = options.partials.directory ? relative(process.cwd(), options.partials.directory) : options.root
        const partialName = relative(partialDir, path)

        Handlebars.registerPartial(options.partials.extname ? partialName : partialName.replace('.hbs', ''), fs.readFileSync(path).toString())
    })

    if (options.helpers) {
        Object.keys(options.helpers).forEach((helper) => {
            Handlebars.registerHelper(helper, options.helpers[helper])
        })
    }

    try {
        const template = Handlebars.compile(content, options.handlebars.compileOptions)

        output.content = template(context, options.handlebars.runtimeOptions)
    } catch (error) {
        output.error = error
    }

    return output
}

const plugin = (options = {}) => {
    options = lodash.merge(defaultOptions, options)

    return {
        name,
        config: ({ root }) => {
            if (!options.root) {
                options.root = root
            }
        },
        transformIndexHtml: {
            enforce: 'pre',
            async transform(content, { path, filename, server }) {
                path = path.replace('?raw', '')
                filename = filename.replace('?raw', '')

                if (
                    !options.filetypes.html.test(path) &&
                    !options.filetypes.json.test(path) &&
                    !content.startsWith('<script type="application/json" data-format="hbs"')
                ) {
                    return content
                }

                if (content.startsWith('<script type="application/json" data-format="hbs"')) {
                    const matches = content.matchAll(/<script\b[^>]*data-format="(?<format>[^>]+)"[^>]*>(?<data>[\s\S]+?)<\/script>/gmi)

                    for (const match of matches) {
                        content = JSON.parse(match.groups.data)
                    }
                }

                const render = await renderTemplate(filename, content, options)

                if (render.error) {
                    if (!server) {
                        console.error(chalk.red(render.error))
                        return
                    }

                    setTimeout(() => server.ws.send({
                        type: 'error',
                        err: {
                            message: render.error.message,
                            plugin: name
                        }
                    }), 50)
                }

                return render.content
            }
        },
        handleHotUpdate({ file, server }) {
            if (
                (typeof options.reload === 'function' && options.reload(file)) ||
                (options.reload && (options.filetypes.html.test(file) || options.filetypes.json.test(file)))
            ) {
                server.ws.send({ type: 'full-reload' })
            }
        }
    }
}

export default plugin
