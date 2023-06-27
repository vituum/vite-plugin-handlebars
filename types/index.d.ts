type KnownHelpers = {
    [name in BuiltinHelperName | CustomHelperName]: boolean;
};

type BuiltinHelperName =
    "helperMissing"|
    "blockHelperMissing"|
    "each"|
    "if"|
    "unless"|
    "with"|
    "log"|
    "lookup";

type CustomHelperName = string;

interface CompileOptions {
    data?: boolean;
    compat?: boolean;
    knownHelpers?: KnownHelpers;
    knownHelpersOnly?: boolean;
    noEscape?: boolean;
    strict?: boolean;
    assumeObjects?: boolean;
    preventIndent?: boolean;
    ignoreStandalone?: boolean;
    explicitPartialContext?: boolean;
}

interface HandlebarsOptions {
    compileOptions?: CompileOptions,
    runtimeOptions?: import('handlebars').ParseOptions
}

interface PartialsOptions {
    directory?: string,
    extname?: boolean
}

export interface PluginUserConfig {
    reload?: boolean | Function
    root?: string
    helpers?: Object
    filters?: Object
    partials?: PartialsOptions
    globals?: Object
    data?: string | string[]
    formats?: string[]
    handlebars?: HandlebarsOptions
    ignoredPaths?: string[]
}

export default function plugin(options?: PluginUserConfig) : import('vite').Plugin
