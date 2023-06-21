import { resolve, relative } from 'path'
import fs from 'fs'
import process from 'node:process'
import FastGlob from 'fast-glob'
import lodash from 'lodash'
import Handlebars from 'handlebars'
import { getPackageInfo, merge, pluginBundle, pluginError, pluginReload, processData } from 'vituum/utils/common.js'
import { renameBuildEnd, renameBuildStart } from 'vituum/utils/build.js'

const { name } = getPackageInfo(import.meta.url)

/**
 * @type {import('@vituum/vite-plugin-handlebars/types').PluginUserConfig}
 */
const defaultOptions = {
    reload: true,
    root: null,
    helpers: {},
    partials: {
        directory: null,
        extname: true
    },
    globals: {},
    data: ['src/data/**/*.json'],
    formats: ['hbs', 'json.hbs', 'json'],
    handlebars: {
        compileOptions: {},
        runtimeOptions: {}
    }
}

const renderTemplate = async ({ filename, server, root }, content, options) => {
    const initialFilename = filename.replace('.html', '')
    const output = {}
    const context = options.data
        ? processData({
            paths: options.data,
            root
        }, options.globals)
        : options.globals

    if (initialFilename.endsWith('.json')) {
        lodash.merge(context, JSON.parse(content))

        if (!options.formats.includes(context.format)) {
            return new Promise((resolve) => {
                output.content = content
                resolve(output)
            })
        }

        content = '{{> (lookup @root \'template\')}}'

        if (typeof context.template === 'undefined') {
            const error = `${name}: template must be defined for file ${initialFilename}`

            return new Promise((resolve) => {
                output.error = error
                resolve(output)
            })
        }

        context.template = relative(process.cwd(), context.template).startsWith(relative(process.cwd(), options.root)) ? resolve(process.cwd(), context.template) : resolve(options.root, context.template)

        context.template = relative(options.root, context.template)
    } else if (fs.existsSync(`${initialFilename}.json`)) {
        lodash.merge(context, JSON.parse(fs.readFileSync(`${initialFilename}.json`).toString()))
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

    return new Promise((resolve) => {
        try {
            const template = Handlebars.compile(content, options.handlebars.compileOptions)

            output.content = template(context, options.handlebars.runtimeOptions)

            resolve(output)
        } catch (error) {
            output.error = error

            resolve(output)
        }
    })
}

/**
 * @param {import('@vituum/vite-plugin-handlebars/types').PluginUserConfig} options
 * @returns [import('vite').Plugin]
 */
const plugin = (options = {}) => {
    let resolvedConfig
    let userEnv

    options = merge(defaultOptions, options)

    return [{
        name,
        config (userConfig, env) {
            userEnv = env
        },
        configResolved (config) {
            resolvedConfig = config

            if (!options.root) {
                options.root = config.root
            }
        },
        buildStart: async () => {
            if (userEnv.command !== 'build') {
                return
            }

            await renameBuildStart(resolvedConfig.build.rollupOptions.input, options.formats)
        },
        buildEnd: async () => {
            if (userEnv.command !== 'build') {
                return
            }

            await renameBuildEnd(resolvedConfig.build.rollupOptions.input, options.formats)
        },
        transformIndexHtml: {
            order: 'pre',
            async transform (content, { filename, server }) {
                if (
                    !options.formats.find(format => filename.replace('.html', '').endsWith(format)) ||
                    (filename.replace('.html', '').endsWith('.json') && !content.startsWith('{'))
                ) {
                    return content
                }

                if (
                    (filename.replace('.html', '').endsWith('.json') && content.startsWith('{')) &&
                    (JSON.parse(content)?.format && !options.formats.includes(JSON.parse(content)?.format))
                ) {
                    return content
                }

                const render = await renderTemplate({ filename, server, root: resolvedConfig.root }, content, options)
                const renderError = pluginError(render.error, server, name)

                if (renderError && server) {
                    return
                } else if (renderError) {
                    return renderError
                }

                return render.content
            }
        },
        handleHotUpdate: ({ file, server }) => pluginReload({ file, server }, options)
    }, pluginBundle(options.formats)]
}

export default plugin
