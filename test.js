const rawrgs = require('.');

console.log(
    rawrgs([
        {
            label: 'x',
            type: 'collector'
        },
        {
            label: 'y',
            type: 'boolean'
        },
        'z'
    ])
);