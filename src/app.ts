import { NavbarCustomButton, Viewer, events } from '@photo-sphere-viewer/core';
import { LensflarePlugin } from 'photo-sphere-viewer-lensflare-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { StereoPlugin } from '@photo-sphere-viewer/stereo-plugin';
import { GalleryItem, GalleryPlugin } from '@photo-sphere-viewer/gallery-plugin';
import { EquirectangularTilesAdapter } from '@photo-sphere-viewer/equirectangular-tiles-adapter';
//import { LittlePlanetAdapter } from '@photo-sphere-viewer/little-planet-adapter';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/gallery-plugin/index.css';
import './app.css';

const defaultNavbar = [
    'autorotate', 'gallery', 'zoom', 'move', 'caption', 'gyroscope', 'stereo', 'fullscreen',
]

interface SettingsItem {
    id: number;
    url: string;
    image: string;
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
    const LITTLEPLANET_MIN_ZOOM = 14
    const LITTLEPLANET_DEF_LAT = -90
    const LITTLEPLANET_FISHEYE = 2
    const LITTLEPLANET_DEF_ZOOM = 0

    // parse arguments from the URL
    const args = new URLSearchParams(location.search);
    /* @ts-ignore */
    const panorama = Number(args.get('panorama')) || __PANO__ || 4;
    const selectedPano = settings.find((pano) => pano.id === panorama);

    if (!selectedPano || Number.isNaN(panorama) || !settings || settings.length < panorama) {
        throw new Error('Invalid panorama');
    }

    // replace ?panorama=X with item.url.toLowercase().html
    args.get('panorama') && history.replaceState(null, '', selectedPano.url.toLowerCase() + '.html');

    const lensflaresSettings = selectedPano.lensflares;

    let littlePlanetEnabled = selectedPano.littlePlanet;

    /* @ts-ignore */
    const baseUrl = `images/`;

    const items = settings.map((item) => {
        const _avif = item.image.endsWith(".avif")
        const _jxl = item.image.endsWith(".jxl")
        return {
            id: item.id,
            name: item.description,
            url: item.url,
            lensflares: item.lensflares,
            panorama: {
                width: 17920,
                cols: 16,
                rows: 8,
                baseUrl: `${baseUrl}/${item.url}_preview.${_avif ? "avif" : _jxl ? "jxl" : "jpg"}`,
                tileUrl: (col: number, row: number) => {
                    return `${baseUrl}tiles/${item.url}/${item.url}_${col}_${row}.${_avif ? "avif" : _jxl ? "jxl" : "jpg"}`
                },
            },
            thumbnail: `${baseUrl}/${item.url}_preview.${_avif ? "avif" : _jxl ? "jxl" : "jpg"}`,
        }
    });

    const viewer = new Viewer({
        container: document.querySelector('#viewer') as HTMLElement,
        adapter: EquirectangularTilesAdapter,
        caption: 'Elia Lazzari <b>&copy; 2023</b> ' + selectedPano.description,
        touchmoveTwoFingers: false,
        panorama: items.find((item) => item.id === panorama)?.panorama,
        mousewheelCtrlKey: false,
        defaultYaw: '130deg',
        fisheye: selectedPano.littlePlanet ? LITTLEPLANET_FISHEYE : false,
        maxFov: selectedPano.littlePlanet ? LITTLEPLANET_MAX_ZOOM : 90,
        minFov: selectedPano.littlePlanet ? LITTLEPLANET_MIN_ZOOM : 40,
        defaultZoomLvl: selectedPano.littlePlanet ? LITTLEPLANET_DEF_ZOOM : 50,
        defaultPitch: selectedPano.littlePlanet ? LITTLEPLANET_DEF_LAT : 0,
        mousewheel: selectedPano.littlePlanet ? false : true,
        navbar: filterNavbar(defaultNavbar),
        plugins: [
            [GalleryPlugin, {
                visibleOnLoad: false,
                hideOnClick: false,
            }],
            GyroscopePlugin,
            [AutorotatePlugin, {
                autostartDelay: 100000,
                autostartOnIdle: false,
            }],
            StereoPlugin,
            [LensflarePlugin, { lensflares: lensflaresSettings }]
        ],
    });

    viewer.addEventListener(events.ClickEvent.type, ({ data }) => {
        // convert to deg
        const yaw = Math.floor(data.yaw * 180 / Math.PI)
        const pitch = Math.floor(data.pitch * 180 / Math.PI)
        console.log(`yaw: ${yaw} pitch: ${pitch}`);
    });

    const lensflarePlugin = viewer.getPlugin(LensflarePlugin) as LensflarePlugin;

    if (args.get('debug') === 'true') {
        /* @ts-ignore */
        window.lensflares = lensflarePlugin;
    }

    const galleryPlugin = viewer.getPlugin(GalleryPlugin) as GalleryPlugin;

    const onGalleryItemClicked = (id: GalleryItem['id']) => {
        // add url parameter to the current url
        const url = new URL(location.href);
        const item = items.find((i) => i.id === Number(id));
        if (!item) {
            throw new Error('Invalid panorama');
        }

        // remove all url parameters 
        url.searchParams.set('panorama', String(id));
        history.replaceState(null, '', url.toString());

        // replace history to item.url.toLowercase() .html
        history.replaceState(null, '', item?.url.toLowerCase() + '.html');

        viewer.setPanorama(item.panorama, {
            caption: item.name,
        });

        // update lensflares
        lensflarePlugin.setLensflares(item.lensflares || []);

        // update title of the page
        document.title = item.name;
    };

    galleryPlugin.setItems(items, onGalleryItemClicked);

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
                    viewer.setOption("maxFov", 70)
                    viewer.setOption("mousewheel", true)
                })
            })

            // show all lensflares
            lensflarePlugin.showAllLensflares()
            return
        }
    });

    const points = selectedPano.autorotatePoints;

    function randomPoints() {
        if (points && points.length > 0) {
            autorotatePlugin.setKeypoints(points);
        }
        autorotatePlugin.stop();

        if (selectedPano?.littlePlanet) {
            // hide all lensflares
            lensflarePlugin.hideAllLensflares()
        }
    }

    viewer.addEventListener('ready', randomPoints, { once: true });

    const _currentNavbar = filterNavbar(defaultNavbar)
    if (selectedPano.littlePlanet) {
        const resetLittlePlanetButton = {
            id: "resetLittlePlanetButton",
            content: `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" fill="none">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 20C16.4183 20 20 16.4183 20 12C20 11.8805 19.9974 11.7615 19.9922 11.6433C20.2479 11.4141 20.4882 11.1864 20.7118 10.9611C21.0037 10.6672 21.002 10.1923 20.708 9.90049C20.4336 9.628 20.0014 9.61143 19.7077 9.84972C19.4023 8.75248 18.8688 7.75024 18.1616 6.89725C18.4607 6.84611 18.7436 6.8084 19.0087 6.784C19.4212 6.74604 19.7247 6.38089 19.6868 5.96842C19.6488 5.55595 19.2837 5.25235 18.8712 5.29032C18.4474 5.32932 17.9972 5.39638 17.5262 5.48921C17.3267 5.52851 17.1614 5.64353 17.0543 5.79852C15.6765 4.67424 13.917 4 12 4C7.58172 4 4 7.58172 4 12C4 12.2776 4.01414 12.552 4.04175 12.8223C3.78987 12.7532 3.50899 12.8177 3.31137 13.0159C2.97651 13.3517 2.67596 13.6846 2.415 14.0113C2.15647 14.3349 2.20924 14.8069 2.53287 15.0654C2.8565 15.3239 3.32843 15.2711 3.58696 14.9475C3.78866 14.695 4.02466 14.4302 4.2938 14.1557C4.60754 15.2796 5.16056 16.3037 5.8945 17.1697C5.66824 17.3368 5.54578 17.6248 5.60398 17.919C5.68437 18.3253 6.07894 18.5896 6.48528 18.5092C6.7024 18.4662 6.92455 18.4177 7.15125 18.3637C8.49656 19.3903 10.1771 20 12 20ZM7.15125 18.3637C6.69042 18.012 6.26891 17.6114 5.8945 17.1697C5.98073 17.106 6.08204 17.0599 6.19417 17.0377C7.19089 16.8405 8.33112 16.5084 9.55581 16.0486C9.94359 15.903 10.376 16.0994 10.5216 16.4872C10.6671 16.8749 10.4708 17.3073 10.083 17.4529C9.05325 17.8395 8.0653 18.1459 7.15125 18.3637ZM19.7077 9.84972C19.6869 9.86663 19.6667 9.88483 19.6474 9.90431C18.9609 10.5957 18.0797 11.3337 17.0388 12.0753C16.7014 12.3157 16.6228 12.784 16.8631 13.1213C17.1035 13.4587 17.5718 13.5373 17.9091 13.297C18.6809 12.7471 19.3806 12.1912 19.9922 11.6433C19.965 11.0246 19.8676 10.4241 19.7077 9.84972ZM20.9366 5.37924C20.5336 5.28378 20.1294 5.53313 20.034 5.93619C19.9385 6.33925 20.1879 6.74339 20.5909 6.83886C20.985 6.93219 21.1368 7.07125 21.1932 7.16142C21.2565 7.26269 21.3262 7.52732 21.0363 8.10938C20.8516 8.48014 21.0025 8.93042 21.3732 9.1151C21.744 9.29979 22.1943 9.14894 22.379 8.77818C22.7566 8.02003 22.9422 7.12886 22.4648 6.36582C22.1206 5.81574 21.5416 5.52252 20.9366 5.37924ZM2.81481 16.2501C2.94057 15.8555 2.72259 15.4336 2.32793 15.3078C1.93327 15.1821 1.51138 15.4 1.38562 15.7947C1.19392 16.3963 1.17354 17.0573 1.53488 17.6349C1.98775 18.3587 2.84153 18.6413 3.68907 18.7224C4.1014 18.7619 4.46765 18.4596 4.50712 18.0473C4.54658 17.635 4.24432 17.2687 3.83199 17.2293C3.13763 17.1628 2.88355 16.9624 2.80651 16.8393C2.75679 16.7598 2.70479 16.5954 2.81481 16.2501ZM15.7504 14.704C16.106 14.4915 16.2218 14.0309 16.0093 13.6754C15.7967 13.3199 15.3362 13.204 14.9807 13.4166C14.4991 13.7045 13.9974 13.9881 13.4781 14.2648C12.9445 14.5491 12.4132 14.8149 11.8883 15.0615C11.5134 15.2376 11.3522 15.6843 11.5283 16.0592C11.7044 16.4341 12.1511 16.5953 12.526 16.4192C13.0739 16.1618 13.6277 15.8847 14.1834 15.5887C14.7242 15.3005 15.2474 15.0048 15.7504 14.704Z" fill="rgba(255,255,255,.7)"/>
            </svg>`,
            title: "Reset Little Planet",
            className: "resetLittlePlanetButton",
            onClick: () => {
                littlePlanetEnabled = true
                const p = viewer.getPlugin("autorotate") as AutorotatePlugin
                if (p) p.stop()
                viewer.setOption("maxFov", LITTLEPLANET_MAX_ZOOM)
                viewer.setOption("minFov", LITTLEPLANET_MIN_ZOOM)
                viewer.setOption("fisheye", LITTLEPLANET_FISHEYE) // @ts-ignore ts(2345)
                viewer.setOption("mousewheel", false)
                viewer.animate({
                    yaw: 0,
                    pitch: LITTLEPLANET_DEF_LAT,
                    zoom: LITTLEPLANET_DEF_ZOOM,
                    speed: "10rpm",
                })

                // hide all lensflares
                lensflarePlugin.hideAllLensflares()
            },
        }
        if (_currentNavbar !== false && !_currentNavbar.find((item) => typeof item === "object" && item?.id === "resetLittlePlanetButton")) {
            _currentNavbar.splice(1, 0, resetLittlePlanetButton)
        }
    }

    // add toggle lensflare visibility button
    const toggleLensflareButton = {
        id: "toggleLensflareButton",
        content: `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" fill="none">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M4.25 19C4.25 18.5858 4.58579 18.25 5 18.25H19C19.4142 18.25 19.75 18.5858 19.75 19C19.75 19.4142 19.4142 19.75 19 19.75H5C4.58579 19.75 4.25 19.4142 4.25 19ZM7.25 22C7.25 21.5858 7.58579 21.25 8 21.25H16C16.4142 21.25 16.75 21.5858 16.75 22C16.75 22.4142 16.4142 22.75 16 22.75H8C7.58579 22.75 7.25 22.4142 7.25 22Z" fill="rgba(255,255,255,.7)"/>
        <path d="M6.08267 15.25C5.5521 14.2858 5.25 13.1778 5.25 12C5.25 8.27208 8.27208 5.25 12 5.25C15.7279 5.25 18.75 8.27208 18.75 12C18.75 13.1778 18.4479 14.2858 17.9173 15.25H22C22.4142 15.25 22.75 15.5858 22.75 16C22.75 16.4142 22.4142 16.75 22 16.75H2C1.58579 16.75 1.25 16.4142 1.25 16C1.25 15.5858 1.58579 15.25 2 15.25H6.08267Z" fill="rgba(255,255,255,.7)"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 1.25C12.4142 1.25 12.75 1.58579 12.75 2V3C12.75 3.41421 12.4142 3.75 12 3.75C11.5858 3.75 11.25 3.41421 11.25 3V2C11.25 1.58579 11.5858 1.25 12 1.25ZM4.39861 4.39861C4.6915 4.10572 5.16638 4.10572 5.45927 4.39861L5.85211 4.79145C6.145 5.08434 6.145 5.55921 5.85211 5.85211C5.55921 6.145 5.08434 6.145 4.79145 5.85211L4.39861 5.45927C4.10572 5.16638 4.10572 4.6915 4.39861 4.39861ZM19.6011 4.39887C19.894 4.69176 19.894 5.16664 19.6011 5.45953L19.2083 5.85237C18.9154 6.14526 18.4405 6.14526 18.1476 5.85237C17.8547 5.55947 17.8547 5.0846 18.1476 4.79171L18.5405 4.39887C18.8334 4.10598 19.3082 4.10598 19.6011 4.39887ZM1.25 12C1.25 11.5858 1.58579 11.25 2 11.25H3C3.41421 11.25 3.75 11.5858 3.75 12C3.75 12.4142 3.41421 12.75 3 12.75H2C1.58579 12.75 1.25 12.4142 1.25 12ZM20.25 12C20.25 11.5858 20.5858 11.25 21 11.25H22C22.4142 11.25 22.75 11.5858 22.75 12C22.75 12.4142 22.4142 12.75 22 12.75H21C20.5858 12.75 20.25 12.4142 20.25 12Z" fill="rgba(255,255,255,.7)"/>
        </svg>`,
        title: "Toggle Lensflare",
        className: "toggleLensflareButton",
        onClick: () => {
            lensflarePlugin.toggleAllLensflares()
        },
    }

    if (_currentNavbar !== false && !_currentNavbar.find((item) => typeof item === "object" && item?.id === "toggleLensflareButton")) {
        _currentNavbar.splice(2, 0, toggleLensflareButton)
    }

    // add toggle navbar visibility button
    const hideNavbarButton = {
        id: "hideNavbarButton",
        content: `<svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" fill="none">
        <g clip-path="url(#clip0_429_11083)">
        <path d="M7 7.00006L17 17.0001M7 17.0001L17 7.00006" stroke="rgba(255,255,255,.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
        <defs>
        <clipPath id="clip0_429_11083">
        <rect width="24" height="24" fill="white"/>
        </clipPath>
        </defs>
        </svg>`,
        title: "Hide Navbar",
        className: "hideNavbarButton",
        onClick: () => {
            viewer.navbar.hide();
            // add a show navbar button that is always hidden until mouseover
            const btn = document.createElement("a")
            btn.className = "showNavbarButton"
            // add svg icon
            btn.innerHTML = `<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 26 26" style="enable-background:new 0 0 26 26;" xml:space="preserve" class="icon icon-back-to-top">
            <g>
              <path d="M13.8,1.3L21.6,9c0.1,0.1,0.1,0.3,0.2,0.4c0.1,0.1,0.1,0.3,0.1,0.4s0,0.3-0.1,0.4c-0.1,0.1-0.1,0.3-0.3,0.4
                c-0.1,0.1-0.2,0.2-0.4,0.3c-0.2,0.1-0.3,0.1-0.4,0.1c-0.1,0-0.3,0-0.4-0.1c-0.2-0.1-0.3-0.2-0.4-0.3L14.2,5l0,19.1
                c0,0.2-0.1,0.3-0.1,0.5c0,0.1-0.1,0.3-0.3,0.4c-0.1,0.1-0.2,0.2-0.4,0.3c-0.1,0.1-0.3,0.1-0.5,0.1c-0.1,0-0.3,0-0.4-0.1
                c-0.1-0.1-0.3-0.1-0.4-0.3c-0.1-0.1-0.2-0.2-0.3-0.4c-0.1-0.1-0.1-0.3-0.1-0.5l0-19.1l-5.7,5.7C6,10.8,5.8,10.9,5.7,11
                c-0.1,0.1-0.3,0.1-0.4,0.1c-0.2,0-0.3,0-0.4-0.1c-0.1-0.1-0.3-0.2-0.4-0.3c-0.1-0.1-0.1-0.2-0.2-0.4C4.1,10.2,4,10.1,4.1,9.9
                c0-0.1,0-0.3,0.1-0.4c0-0.1,0.1-0.3,0.3-0.4l7.7-7.8c0.1,0,0.2-0.1,0.2-0.1c0,0,0.1-0.1,0.2-0.1c0.1,0,0.2,0,0.2-0.1
                c0.1,0,0.1,0,0.2,0c0,0,0.1,0,0.2,0c0.1,0,0.2,0,0.2,0.1c0.1,0,0.1,0.1,0.2,0.1C13.7,1.2,13.8,1.2,13.8,1.3z"></path>
            </g>
            </svg>`
            btn.title = "Show Navbar"
            btn.onclick = (e) => {
                e.preventDefault()
                viewer.navbar.show()
                btn.remove()
            }

            // add the button to the viewer container
            document.body.appendChild(btn)
        },
    }

    if (_currentNavbar !== false && !_currentNavbar.find((item) => typeof item === "object" && item?.id === "hideNavbarButton")) {
        _currentNavbar.push(hideNavbarButton)
    }

    viewer.setOption("navbar", _currentNavbar)

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