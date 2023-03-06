import { NavbarCustomButton, Viewer } from '@photo-sphere-viewer/core';
import { LensflarePlugin } from 'photo-sphere-viewer-lensflare-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { StereoPlugin } from '@photo-sphere-viewer/stereo-plugin';
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
//import { LittlePlanetAdapter } from '@photo-sphere-viewer/little-planet-adapter';
import '@photo-sphere-viewer/core/index.css';

const defaultNavbar = [
    'autorotate', 'zoom', 'move', 'caption', 'gyroscope', 'stereo', 'fullscreen'
]

interface SettingsItem {
    id: number;
    url: string;
    description: string;
    littlePlanet?: boolean;
    lensflares?: Array<any>;
    autorotatePoints?: Array<any>;
}

fetch("settings.json").then((response) => response.json()).then((settings: Array<SettingsItem>) => {
    function filterNavbar(navbar?: boolean | string | Array<string | NavbarCustomButton>): false | Array<string | NavbarCustomButton> {
        if (navbar == null) return defaultNavbar
        if (!Array.isArray(navbar)) {
            if (typeof navbar === "string") {
                return navbar === "" ? false : [navbar]
            }
            return navbar ? defaultNavbar : false
        }
        return navbar
    }

    let LITTLEPLANET_MAX_ZOOM = 130
    const LITTLEPLANET_DEF_LAT = -90
    const LITTLEPLANET_FISHEYE = 2
    const LITTLEPLANET_DEF_ZOOM = 0

    // parse arguments from the URL
    const args = new URLSearchParams(location.search);
    const panorama = Number(args.get('panorama')) || 3;
    const selectedPano = settings.find((pano) => pano.id === panorama);

    if (!selectedPano || Number.isNaN(panorama) || !settings || settings.length < panorama) {
        throw new Error('Invalid panorama');
    }

    const lensflaresSettings = selectedPano.lensflares;

    let littlePlanetEnabled = selectedPano.littlePlanet;

    const baseUrl = "images/"

    const viewer = new Viewer({
        container: document.querySelector('#viewer') as HTMLElement,
        adapter: EquirectangularTilesAdapter,
        caption: 'Elia Lazzari <b>&copy; 2023</b> ' + selectedPano.description,
        touchmoveTwoFingers: false,
        panorama: {
            width: 17920,
            cols: 16,
            rows: 8,
            baseUrl: `${baseUrl}/${selectedPano.url}_preview.jpg`,
            tileUrl: (col: number, row: number) => {
                return `${baseUrl}tiles/${selectedPano.url}/${selectedPano.url}_${col}_${row}.jpg`
            },
        },
        mousewheelCtrlKey: false,
        defaultYaw: '130deg',
        fisheye: selectedPano.littlePlanet ? LITTLEPLANET_FISHEYE : false,
        maxFov: selectedPano.littlePlanet ? LITTLEPLANET_MAX_ZOOM : 90,
        defaultZoomLvl: selectedPano.littlePlanet ? LITTLEPLANET_DEF_ZOOM : 50,
        defaultPitch: selectedPano.littlePlanet ? LITTLEPLANET_DEF_LAT : 0,
        // when it undefined, = true, then use input value.
        // The input value maybe false, value || true => false => true
        mousewheel: selectedPano.littlePlanet ? false : true,
        navbar: filterNavbar(defaultNavbar),
        plugins: [
            GyroscopePlugin,
            [AutorotatePlugin, {
                autostartDelay: 100000,
                autostartOnIdle: false,
            }],
            StereoPlugin,
            [LensflarePlugin, { lensflares: lensflaresSettings }]
        ],
    });

    const lensflarePlugin = viewer.getPlugin(LensflarePlugin) as LensflarePlugin;

    if (args.get('debug') === 'true') {
        /* @ts-ignore */
        window.lensflares = lensflarePlugin;
    }

    const autorotatePlugin = viewer.getPlugin(AutorotatePlugin) as AutorotatePlugin;

    viewer.addEventListener('click', () => {
        if (selectedPano.littlePlanet && littlePlanetEnabled) {
            littlePlanetEnabled = false
            // fly inside the sphere
            viewer.animate({
                yaw: 0,
                pitch: LITTLEPLANET_DEF_LAT,
                zoom: 75,
                speed: "3rpm",
            }).then(() => {
                // watch on the sky
                viewer.animate({
                    yaw: 0,
                    pitch: 0,
                    zoom: 90,
                    speed: "10rpm",
                }).then(() => {
                    // Disable Little Planet.
                    const p = viewer.getPlugin("autorotate") as AutorotatePlugin
                    if (p) p.start()
                    viewer.setOption("maxFov", 40)
                    viewer.setOption("mousewheel", true)
                })
            })
            return
        }
        autorotatePlugin.start();
    });

    const points = selectedPano.autorotatePoints;

    function randomPoints() {
        if (points && points.length > 0) {
            autorotatePlugin.setKeypoints(points);
        }
        autorotatePlugin.stop();
    }

    viewer.addEventListener('ready', randomPoints, { once: true });

    if (selectedPano.littlePlanet) {
        const resetLittlePlanetButton = {
            id: "resetLittlePlanetButton",
            content: "🪐",
            title: "Reset Little Planet",
            className: "resetLittlePlanetButton",
            onClick: () => {
                littlePlanetEnabled = true
                const p = viewer.getPlugin("autorotate") as AutorotatePlugin
                if (p) p.stop()
                viewer.setOption("maxFov", LITTLEPLANET_MAX_ZOOM)
                //viewer.setOption("fisheye", LITTLEPLANET_FISHEYE) // @ts-ignore ts(2345)
                viewer.setOption("mousewheel", false)
                viewer.animate({
                    yaw: 0,
                    pitch: LITTLEPLANET_DEF_LAT,
                    zoom: LITTLEPLANET_DEF_ZOOM,
                    speed: "10rpm",
                })
            },
        }
        const _currentNavbar = filterNavbar(defaultNavbar)
        if (_currentNavbar !== false && !_currentNavbar.find((item) => typeof item === "object" && item?.id === "resetLittlePlanetButton")) {
            _currentNavbar.splice(1, 0, resetLittlePlanetButton)
            viewer.setOption("navbar", _currentNavbar)
        }
    }

    function map(_in: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        return (_in - inMin) * (outMax - outMin) / (inMax - inMin) + outMin
    }

    function handleResize() {
        const aspectRatio = window.innerWidth / window.innerHeight
        //console.log(aspectRatio)
        LITTLEPLANET_MAX_ZOOM = Math.floor(map(aspectRatio, 0.5, 1.8, 140, 115))
    }
    // Add event listener
    window.addEventListener("resize", handleResize)

    handleResize()
});