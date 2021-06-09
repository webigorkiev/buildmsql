const path = require('path');
const nodeExternals = require("webpack-node-externals");

module.exports = {
    target: "node",
    entry: './src/index.ts',
    externals: [nodeExternals()],
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
            "@": path.resolve("./src/"),
        }
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
        library:{
            type: "commonjs2"
        },
        globalObject: "this"
    }
};