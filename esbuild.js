/* eslint-disable no-useless-escape */
// esbuild.js
import { execSync } from "child_process"
import { build, context } from "esbuild"
import fs from "fs"
import figlet from "figlet"
import path from "path"

// INSTALL MAGICK IF YOU ARE ON LINUX
console.log("\u001b[36mInstalling dependencies...\u001b[37m")

const INPUT_INAGE_BASE_PATH = "src/images/"
const OUTPUT_IMAGE_PATH = "public/images/"

const pkg = JSON.parse(fs.readFileSync("./package.json"))

const rebuild = process.argv.includes("--rebuild") // distrugge il precedente build e ricostruisce le immagini da zero (lento) 
const just = process.argv.includes("--just") // ricostruisce solo le immagini selezionate (veloce) "npm run build --just thorsmork,landmannalaugar"
const watch = process.argv.includes("--watch")
const code = process.argv.includes("--just-code")
const dev = process.argv.includes("--dev") || process.env.NODE_ENV === "development"

const site = "https://srv.eliusoutdoor.com/immersive/"

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

let firstBuild = code ? false : true

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

                    const settings = JSON.parse(fs.readFileSync("src/settings.json"))

                    settings.forEach((item) => {
                        const panoPath = `public/${item.url.toLowerCase()}.html`
                        if (fs.existsSync(panoPath)) {
                            fs.rmSync(panoPath, { recursive: true })
                        }

                        // read index.html and replace "dist/app.js" with "../dist/app.js". then add a script tag with the variable __PANO__ set to the item.id
                        let html = fs.readFileSync("src/index.html").toString()
                        html = html.replace("__PANO__ = 4", `__PANO__ = ${item.id}`)

                        // SEO stuff
                        let seo = ""
                        /*
                            add the following tags:
                            title, description, keywords, og:title, og:description, og:url, og:image, og:type, twitter:card, twitter:title, twitter:description, twitter:image, twitter:url

                            the images are in public/images/${item.url}_preview.jpg
                            the other tags are in src/settings.json
                        */
                        let keywords = "virtualtour, virtual, tour, vr, 360, photosphere, streetview" + item.tags?.map((tag) => `, ${tag}`).join("")

                        seo += `<title>${item.name}</title>\n`
                        seo += `    <meta name="description" content="${item.description}">\n`
                        seo += `    <meta name="keywords" content="${keywords}">\n`
                        seo += `    <meta property="og:title" content="${item.name}">\n`
                        seo += `    <meta property="og:description" content="${item.description}">\n`
                        seo += `    <meta property="og:url" content="${site}${item.url.toLowerCase()}.html">\n`
                        seo += `    <meta property="og:image" content="${site}images/${item.url}_preview.jpg">\n`
                        seo += `    <meta property="og:type" content="website">\n`
                        seo += `    <meta name="twitter:card" content="summary_large_image">\n`
                        seo += `    <meta name="twitter:title" content="${item.name}">\n`
                        seo += `    <meta name="twitter:description" content="${item.description}">\n`
                        seo += `    <meta name="twitter:image" content="${site}images/${item.url}_preview.jpg">\n`
                        seo += `    <meta name="twitter:url" content="${site}${item.url.toLowerCase()}.html">\n`

                        html = html.replace("<!-- __SEO__ -->", seo)

                        fs.writeFileSync(panoPath, html)
                    })
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
                            if (file.endsWith(".jpg") || file.endsWith(".JPG") || file.endsWith(".jpeg") || file.endsWith(".JPEG") || file.endsWith(".avif") || file.endsWith(".AVIF") || file.endsWith(".jxl") || file.endsWith(".JXL")) {
                                console.log(`\u001b[36mProcessing ${file}...\u001b[37m`)
                                const fileWithoutExtension = file.split(".")[0]

                                if (just) {
                                    const justFiles = process.argv[process.argv.indexOf("--just") + 1].split(",")
                                    if (!justFiles.includes(fileWithoutExtension)) {
                                        console.log(`\u001b[36mSkipping ${file} because it is not in the list of files to process...\u001b[37m`)
                                        return
                                    }
                                }

                                // delete directory for tiles if it exists
                                if (fs.existsSync(path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension))) {
                                    if (!rebuild && !just) {
                                        console.log(`\u001b[36mSkipping ${file} because it already exists...\u001b[37m`)
                                        return
                                    }
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

                                const avif = file.endsWith(".avif") || file.endsWith(".AVIF")
                                const jxl = file.endsWith(".jxl") || file.endsWith(".JXL")

                                console.log(`\u001b[36mDownsizing ${file} to ${adaptedWidth}x${adaptedHeight}...\u001b[37m`)

                                const copyrightNotice = "Copyright © 2024 Elia Lazzari. All rights reserved.";

                                switch (process.platform) {
                                    case "darwin":
                                        execSync(`magick ${INPUT_INAGE_BASE_PATH}${file} -resize ${adaptedWidth}x${adaptedHeight} -quality ${jxl || avif ? 80 : 70} -strip -set comment "${copyrightNotice}" ${OUTPUT_IMAGE_PATH}${file}`);
                                        break;
                                    case "win32":
                                        execSync(`magick.exe ${INPUT_INAGE_BASE_PATH}${file} -resize ${adaptedWidth}x${adaptedHeight} -quality ${jxl || avif ? 80 : 70} -strip -set comment "${copyrightNotice}" ${OUTPUT_IMAGE_PATH}${file}`);
                                        break;
                                    default:
                                        execSync(`convert ${INPUT_INAGE_BASE_PATH}${file} -resize ${adaptedWidth}x${adaptedHeight} -quality ${jxl || avif ? 80 : 70} -strip -set comment "${copyrightNotice}" ${OUTPUT_IMAGE_PATH}${file}`);
                                        break;
                                }

                                console.log(`\u001b[36mCreating preview of ${file}...\u001b[37m`)

                                // make a copy of the downsized image in the 20% of resolution
                                switch (process.platform) {
                                    case "darwin":
                                        if (!jxl) execSync(`magick ${OUTPUT_IMAGE_PATH}${file} -resize 20% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.${avif ? "avif" : "jpg"}`)
                                        if (jxl) execSync(`magick ${OUTPUT_IMAGE_PATH}${file} -resize 30% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.jxl`)
                                        break
                                    case "win32":
                                        if (!jxl) execSync(`magick.exe ${OUTPUT_IMAGE_PATH}${file} -resize 20% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.${avif ? "avif" : "jpg"}`)
                                        if (jxl) execSync(`magick.exe ${OUTPUT_IMAGE_PATH}${file} -resize 30% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.jxl`)
                                        break
                                    default:
                                        if (!jxl) execSync(`convert ${OUTPUT_IMAGE_PATH}${file} -resize 20% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.${avif ? "avif" : "jpg"}`)
                                        if (jxl) execSync(`convert ${OUTPUT_IMAGE_PATH}${file} -resize 30% ${OUTPUT_IMAGE_PATH}${fileWithoutExtension}_preview.jxl`)
                                        break
                                }

                                console.log(`\u001b[36mSplitting ${file} into tiles...\u001b[37m`)

                                // split image into tiles
                                switch (process.platform) {
                                    case "darwin":
                                        execSync(`magick ${OUTPUT_IMAGE_PATH}${file} \
                                        -crop ${tileWidth}x${tileHeight} \
                                        -set filename:tile "%[fx:page.x/${tileWidth}]_%[fx:page.y/${tileHeight}]" \
                                        -set filename:orig %t \
                                        ${path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension, "/")}%[filename:orig]_%[filename:tile].${avif ? "avif" : jxl ? "jxl" : "jpg"}`)
                                        break
                                    case "win32":
                                        execSync(`magick.exe ${OUTPUT_IMAGE_PATH}${file} \
                                        -crop ${tileWidth}x${tileHeight} \
                                        -set filename:tile "%[fx:page.x/${tileWidth}]_%[fx:page.y/${tileHeight}]" \
                                        -set filename:orig %t \
                                        ${path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension, "/")}%[filename:orig]_%[filename:tile].${avif ? "avif" : jxl ? "jxl" : "jpg"}`)
                                        break
                                    default:
                                        execSync(`convert ${OUTPUT_IMAGE_PATH}${file} \
                                        -crop ${tileWidth}x${tileHeight} \
                                        -set filename:tile "%[fx:page.x/${tileWidth}]_%[fx:page.y/${tileHeight}]" \
                                        -set filename:orig %t \
                                        ${path.join(OUTPUT_IMAGE_PATH, "tiles", fileWithoutExtension, "/")}%[filename:orig]_%[filename:tile].${avif ? "avif" : jxl ? "jxl" : "jpg"}`)
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
