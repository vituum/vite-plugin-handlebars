import { resolve, relative } from 'path'
import fs from 'fs'
import FastGlob from 'fast-glob'
import lodash from 'lodash'
import Handlebars from 'handlebars'
import {
    getPackageInfo,
    merge,
    pluginBundle,
    pluginMiddleware,
    pluginReload,
    pluginTransform,
    processData,
    normalizePath
} from 'vituum/utils/common.js'
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
    globals: {
        format: 'hbs'
    },
    data: ['src/data/**/*.json'],
    formats: ['hbs', 'json.hbs', 'json'],
    handlebars: {
        compileOptions: {},
        runtimeOptions: {}
    },
    ignoredPaths: []
}

const renderTemplate = async ({ filename, server, resolvedConfig }, content, options) => {
    const initialFilename = filename.replace('.html', '')
    const output = {}
    const context = options.data
        ? processData({
            paths: options.data,
            root: resolvedConfig.root
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

        context.template = relative(resolvedConfig.root, context.template).startsWith(relative(resolvedConfig.root, options.root)) ? resolve(resolvedConfig.root, context.template) : resolve(options.root, context.template)
        context.template = normalizePath(relative(options.root, context.template))
    } else if (fs.existsSync(`${initialFilename}.json`)) {
        lodash.merge(context, JSON.parse(fs.readFileSync(`${initialFilename}.json`).toString()))
    }

    const partialGlob = !options.partials.directory ? `${normalizePath(options.root)}/**/*.hbs` : `${normalizePath(resolve(resolvedConfig.root, options.partials.directory))}/**/*.hbs`

    FastGlob.sync(partialGlob).map(entry => resolve(resolvedConfig.root, entry)).forEach(path => {
        const partialDir = options.partials.directory ? relative(resolvedConfig.root, options.partials.directory) : options.root
        const partialName = normalizePath(relative(partialDir, path))

        Handlebars.registerPartial(options.partials.extname ? partialName : partialName.replace('.hbs', ''), fs.readFileSync(path).toString())
    })

    if (options.helpers) {
        Object.keys(options.helpers).forEach(helper => {
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
            if (userEnv.command !== 'build' || !resolvedConfig.build.rollupOptions.input) {
                return
            }

            await renameBuildStart(resolvedConfig.build.rollupOptions.input, options.formats)
        },
        buildEnd: async () => {
            if (userEnv.command !== 'build' || !resolvedConfig.build.rollupOptions.input) {
                return
            }

            await renameBuildEnd(resolvedConfig.build.rollupOptions.input, options.formats)
        },
        transformIndexHtml: {
            order: 'pre',
            async handler (content, { path, filename, server }) {
                return pluginTransform(content, { path, filename, server }, { name, options, resolvedConfig, renderTemplate })
            }
        },
        handleHotUpdate: ({ file, server }) => pluginReload({ file, server }, options)
    }, pluginBundle(options.formats), pluginMiddleware(name, options.formats)]
}

export default plugin
