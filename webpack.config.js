const path = require('path');

module.exports = {
    entry: './script/main.js',
    mode:'development',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, './dist')
    },
    node: {
        fs: 'empty'
    },
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
            use: {
                loader: 'babel-loader',
            }
        }]
    },
};
