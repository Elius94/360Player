/* eslint-disable no-useless-escape */
// esbuild.js
import { execSync } from "child_process"
import { build, context } from "esbuild"
import fs from "fs"
import figlet from "figlet"
import path from "path"

// INSTALL MAGICK IF YOU ARE ON LINUX
console.log("\u001b[36mInstalling dependencies...\u001b[37m")
/*if (process.platform === "linux") {
    execSync("apt update")
    execSync("apt install imagemagick")
} else if (process.platform === "win32") {
    execSync("choco install imagemagick")
} else if (process.platform === "darwin") {
    execSync("brew install imagemagick")
}*/

const INPUT_INAGE_BASE_PATH = "src/images/"
const OUTPUT_IMAGE_PATH = "public/images/"

const pkg = JSON.parse(fs.readFileSync("./package.json"))

const watch = process.argv.includes("--watch")
const dev = process.argv.includes("--dev") || process.env.NODE_ENV === "development"

const banner = "/* eslint-disable linebreak-style */\n" +
    "/*\n" +
    figlet.textSync("Eliusoutdoor 360Player", { horizontalLayout: "full", font: "Big" }) +
    "\n" +
    `                                                                                v${pkg.version}\n\n\n` +
    `   ${pkg.description}\n\n` +
    `   Author: ${pkg.author}\n` +
    `   License: ${pkg.license}\n` +
    `   Repository: ${pkg.repository.url}\n\n` +
    `   Build date: ${new Date().toUTCString()}\n\n` +
    "   This program is free software: you can redistribute it and/or modify */\n\n"

let firstBuild = true

const buildOptions = {
    entryPoints: ["src/app.ts"],
    bundle: true,
    minify: dev ? false : true,
    sourcemap: true,
    color: true,
    outdir: "public/dist",
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
                    // copy src/index.html to public/index.html
                    fs.copyFileSync("src/index.html", "public/index.html")
                    fs.copyFileSync("src/settings.json", "public/settings.json")
                })
            }
        },
        {
            name: "SplitIntoTilesPlugin",
            setup(build) {
                build.onEnd(() => {
                    if (!firstBuild) {
                        return
                    }
                    firstBuild = false
                    const columns = 16
                    const rows = 8
                    console.log("\u001b[36mSplitting into tiles...\u001b[37m")
                    // iterate over all images in INPUT_INAGE_BASE_PATH and split them into tiles
                    fs.readdir(INPUT_INAGE_BASE_PATH, (err, files) => {
                        if (err) {
                            console.log(err)
                            return
                        }
                        files.forEach(file => {
                            if (file.endsWith(".jpg") || file.endsWith(".JPG") || file.endsWith(".jpeg") || file.endsWith(".JPEG")) {
                                const fileWithoutExtension = file.split(".")[0]
                                // delete directory for tiles if it exists
                                if (fs.existsSync(path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension))) {
                                    fs.rmSync(path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension), { recursive: true })
                                }
                                // create directory for tiles
                                fs.mkdirSync(path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension), { recursive: true })
                                const fileSize = {
                                    width: 0,
                                    height: 0
                                }
                                // get image size
                                switch (process.platform) {
                                    case "darwin":
                                        fileSize.width = execSync(`magick identify -format "%w" ${INPUT_INAGE_BASE_PATH}${file}`).toString().trim()
                                        fileSize.height = execSync(`magick identify -format "%h" ${INPUT_INAGE_BASE_PATH}${file}`).toString().trim()
                                        break
                                    case "win32":
                                        fileSize.width = execSync(`magick.exe identify -format "%w" ${INPUT_INAGE_BASE_PATH}${file}`).toString().trim()
                                        fileSize.height = execSync(`magick.exe identify -format "%h" ${INPUT_INAGE_BASE_PATH}${file}`).toString().trim()
                                        break
                                    default:
                                        fileSize.width = execSync(`identify -format "%w" ${INPUT_INAGE_BASE_PATH}${file}`).toString().trim()
                                        fileSize.height = execSync(`identify -format "%h" ${INPUT_INAGE_BASE_PATH}${file}`).toString().trim()
                                        break
                                }
                                const tileWidth = Math.floor(fileSize.width / columns)
                                const tileHeight = Math.floor(fileSize.height / rows)
                                // downsizing image to be able to split it into tiles
                                const adaptedWidth = tileWidth * columns
                                const adaptedHeight = tileHeight * rows
                                switch (process.platform) {
                                    case "darwin":
                                        execSync(`magick ${INPUT_INAGE_BASE_PATH}${file} -resize ${adaptedWidth}x${adaptedHeight} -quality 70 ${OUTPUT_IMAGE_PATH}${file}`)
                                        break
                                    case "win32":
                                        execSync(`magick.exe ${INPUT_INAGE_BASE_PATH}${file} -resize ${adaptedWidth}x${adaptedHeight} -quality 70 ${OUTPUT_IMAGE_PATH}${file}`)
                                        break
                                    default:
                                        execSync(`convert ${INPUT_INAGE_BASE_PATH}${file} -resize ${adaptedWidth}x${adaptedHeight} -quality 70 ${OUTPUT_IMAGE_PATH}${file}`)
                                        break
                                }

                                // make a copy of the downsized image in the 20% of resolution
                                switch (process.platform) {
                                    case "darwin":
                                        execSync(`magick ${OUTPUT_IMAGE_PATH}${file} -resize 20% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.jpg`)
                                        break
                                    case "win32":
                                        execSync(`magick.exe ${OUTPUT_IMAGE_PATH}${file} -resize 20% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.jpg`)
                                        break
                                    default:
                                        execSync(`convert ${OUTPUT_IMAGE_PATH}${file} -resize 20% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.jpg`)
                                        break
                                }

                                // split image into tiles
                                switch (process.platform) {
                                    case "darwin":
                                        execSync(`magick ${OUTPUT_IMAGE_PATH}${file} \
                                        -crop ${tileWidth}x${tileHeight} \
                                        -set filename:tile "%[fx:page.x/${tileWidth}]_%[fx:page.y/${tileHeight}]" \
                                        -set filename:orig %t \
                                        ${path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension, "/")}%[filename:orig]_%[filename:tile].jpg`)
                                        break
                                    case "win32":
                                        execSync(`magick.exe ${OUTPUT_IMAGE_PATH}${file} \
                                        -crop ${tileWidth}x${tileHeight} \
                                        -set filename:tile "%[fx:page.x/${tileWidth}]_%[fx:page.y/${tileHeight}]" \
                                        -set filename:orig %t \
                                        ${path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension, "/")}%[filename:orig]_%[filename:tile].jpg`)
                                        break
                                    default:
                                        execSync(`convert ${OUTPUT_IMAGE_PATH}${file} \
                                        -crop ${tileWidth}x${tileHeight} \
                                        -set filename:tile "%[fx:page.x/${tileWidth}]_%[fx:page.y/${tileHeight}]" \
                                        -set filename:orig %t \
                                        ${path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension, "/")}%[filename:orig]_%[filename:tile].jpg`)
                                        break
                                }
                            }
                        })
                    })
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
        servedir: "public",
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
