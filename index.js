/*
rawrgs -- A super lightweight argument parser for Node.JS with zero external dependencies

This is something I wrote in my free time. I admit it's not the cleanest
code, but it was written in just an hour or two for the sake of a small
project that I was doing with zero external dependencies, so I needed to
write my own argument parser. I tweaked it later, and now you have this.

I may separate this into separate files later for the sake of sanity,
but for now it's all one big beautiful mess of code :)
*/

/** 
 * @typedef {object} RawrgsOption
 * @property {string} label The label of the option.
 * @property {string} [type='normal'] The type of the option.
 * @property {string | string[]} aliases The aliases for the option.
 */

/**
 * @typedef {object} RawrgsResults
 * @property {string[]} _ The remainder of the args.
 * 
 * All options are accessible by their label.
 */

const objectFormat = /^[\w\.]+=.*?(;[\w\.]+=.*?)*$/;

const set = (obj, path, val) => {
    const out = obj || {};
    const parts = path.split('.');
    let next = parts.shift();
    let curr = out;

    while (parts.length >= 1) {
        curr = curr[next] || (curr[next] = {});
        next = parts.shift();
    }

    curr[next] = val;

    return out;
};

const combine = (target, source) => {
    const out = target || {};

    Object.keys(source).forEach(key => {
        if (typeof out[key] === 'object' && typeof source[key] === 'object') {
            out[key] = combine(out[key], source[key]);
        } else {
            out[key] = source[key];
        }
    });

    return out;
};

const toObject = value => {
    if (objectFormat.test(value)) {
        const statements = value.split(';');
        const out = {};
        statements.forEach(statement => {
            const parts = statement.split('=');
            const path = parts[0];
            // Restore other equals signs
            const val = parts.slice(1).join('=');
            set(out, path, val);
        });
        return out;
    }
    return { value };
};

const isBool = value => ['yes', 'no', 'true', 'false'].indexOf(value.toLowerCase()) > -1;
const toBool = value => {
    if (typeof value === 'string') {
        const lower = value.toLowerCase();

        switch (lower) {
            case 'true':
            case 'yes':
                return true;
            default:
                return false;
        }
    };

    return !!value;
}

const transform = value => {
    if (!value) {
        return true;
    }

    if (!isNaN(value)) {
        return parseInt(value);
    } else if (isBool(value)) {
        return toBool(value);
    } else {
        return value;
    }
};

/**
 * Transforms the settings array and handles various forms of input.
 * 
 * @param {RawrgsOption[]} settings The settings to transform.
 * @returns {RawrgsOption[]} The transformed settings. 
 */
const transformSettings = (settings = []) => {
    return settings.map(option => {
        let transformed = option || {};
        if (typeof option === 'string') {
            transformed = { label: option };
        }

        if (!transformed.label) {
            return;
        }

        return Object.assign({
            type: 'normal',
            aliases: []
        }, transformed)
    }).filter(option => option /* filter invalid options */);
};

/**
 * @param {RawrgsOption} option The option settings.
 * @returns {string[]} The aliases for the given option.
 */
const getAliases = option => [].concat(option.aliases);

/**
 * @param {RawrgsOption[]} settings The option array.
 * @param {string} label The label of the option.
 * @returns {RawrgsOption?} The options for the option with the given label. 
 */
const getOptionSettings = (settings, label) => {
    return settings.find(options => options.label === label || getAliases(options).indexOf(label) > -1);
};

/**
 * Removes the first element from a string array if it exists and isn't a number.
 * @param {string[]} [input=[]] The input array.
 * @returns {string} The next shifted element or an empty string.
 */
const safeShift = (input = []) => {
    return (input[0] && input[0].startsWith('-') && isNaN(input[0])) ? '' : input.shift();
}

/**
 * Parses the args with the given settings and defaults.
 * 
 * @param {RawrgsOption[]} settings The settings for the argument parser.
 * @param {object} defaults The default values for arguments.
 * @param {string[]} args The arguments array to parse.
 * 
 * @return {RawrgsResults} The parse results.
 */
module.exports = (settings, defaults = {}, args = process.argv.slice(2)) => {
    let input = args.slice(0); // dereference
    const options = {};
    let next;

    settings = transformSettings(settings);

    while (next = input[0]) {
        if (!next.startsWith('-')) {
            break;
        }

        input.shift();

        if (next == '--') {
            break;
        }

        // We already know next[0] === '-' from the startsWith, let's check next[1]

        const longName = next[1] === '-';
        const rawLabel = longName ? next.substr(2) : next[1];
        const remainder = longName ? '' : next.substr(2);

        const { label, type } = getOptionSettings(settings, rawLabel);

        const value = transform(remainder || safeShift(input));

        if (!label) {
            continue;
        }

        if (type === 'collector') {
            (options[label] || (options[label] = [])).push(value);
        } else if (type === 'object') {
            options[label] = combine(options[label] || {}, toObject(value));
        } else if (type === 'number') {
            if (typeof value !== 'number') {
                continue;
            }
            options[label] = value;
        } else if (type === 'array') {
            options[label] = `${value}`.split(',').map(transform);
        } else if (type === 'boolean') {
            options[label] = toBool(value);
        } else {
            options[label] = value;
        }
    }

    options._ = input;

    return combine(defaults, options);
}