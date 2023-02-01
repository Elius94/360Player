/* eslint-disable no-useless-escape */
// esbuild.js
import { execSync } from "child_process"
import { build, context } from "esbuild"
import fs from "fs"
import figlet from "figlet"
import Compress from "compress-images"

const INPUT_IMAGE_PATH = "src/images/**/*.{jpg,JPG,jpeg,JPEG,png,svg,gif}"
const OUTPUT_IMAGE_PATH = "_site/images/"

const pkg = JSON.parse(fs.readFileSync("./package.json"))

const watch = process.argv.includes("--watch")
const dev = process.argv.includes("--dev") || process.env.NODE_ENV === "development"

const banner = "/* eslint-disable linebreak-style */\n" +
    "/*\n" +
    figlet.textSync("Up Urban Climbing", { horizontalLayout: "full", font: "Big" }) +
    "\n" +
    `                                                                                v${pkg.version}\n\n\n` +
    `   ${pkg.description}\n\n` +
    `   Author: ${pkg.author}\n` +
    `   License: ${pkg.license}\n` +
    `   Repository: ${pkg.repository.url}\n\n` +
    `   Build date: ${new Date().toUTCString()}\n\n` +
    "   This program is free software: you can redistribute it and/or modify */\n\n"

const buildOptions = {
    entryPoints: ["src/app.ts"],
    bundle: true,
    minify: dev ? false : true,
    sourcemap: true,
    color: true,
    outdir: "_site/dist",
    target: ['chrome58', 'firefox57', 'safari11', 'edge18'],
    banner: {
        js: banner
    },
    plugins: [
        {
            name: "TypeScriptDeclarationsPlugin",
            setup(build) {
                build.onEnd((result) => {
                    if (result.errors.length > 0) {
                        console.log("\u001b[31mESM Build failed!\u001b[37m")
                        process.exit(1)
                    }
                    execSync("npx tsc --emitDeclarationOnly")
                    console.log("\u001b[36mTypeScript declarations generated!\u001b[37m")
                    // copy src/index.html to _site/index.html
                    fs.copyFileSync("src/index.html", "_site/index.html")
                })
            }
        },
        {
            name: "CompressImagesPlugin",
            setup(build) {
                build.onEnd(() => {
                    console.log("\u001b[36mCompressing images...\u001b[37m")
                    Compress(INPUT_IMAGE_PATH, OUTPUT_IMAGE_PATH, {
                        compress_force: false,
                        statistic: true,
                        autoupdate: true,
                        
                    }, false,
                        { jpg: { engine: "mozjpeg", command: ["-quality", "70"] } },
                        { png: { engine: "false", command: false } },
                        { svg: { engine: "false", command: false } },
                        { gif: { engine: "false", command: false } },
                        function (error, completed, statistic) {
                            console.log("-------------");
                            console.log(error);
                            console.log(completed);
                            console.log(statistic);
                            console.log("-------------");
                        }
                    )
                })
            }
        }
    ]
}

if (dev) {
    const ctx = await context(buildOptions)

    if (watch) await ctx.watch().then(() => {
        console.log("\u001b[36mWatching...\u001b[37m")
    })

    // Enable serve mode
    await ctx.serve({
        servedir: "_site",
        port: 8080,
        onRequest: (args) => {
            if (args.path === "/") {
                args.path = "/index.html"
            }
            console.log(`\u001b[36m${args.method} ${args.path}\u001b[37m`)
        }
    }).then((server) => {
        console.log(`\u001b[36mServing at http://localhost:${server.port}\u001b[37m`)
        // Open browser
        switch (process.platform) {
            case "darwin":
                execSync(`open http://localhost:${server.port}`)
                break
            case "win32":
                execSync(`start http://localhost:${server.port}`)
                break
            default:
                execSync(`xdg-open http://localhost:${server.port}`)
        }
    })
} else {
    await build(buildOptions)
}

console.log("\u001b[36mESM Build succeeded!\u001b[37m")

// Enable watch mode
