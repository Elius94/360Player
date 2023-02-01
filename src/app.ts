import { Viewer } from '@photo-sphere-viewer/core';
import { LensflarePlugin } from 'photo-sphere-viewer-lensflare-plugin';
import { GyroscopePlugin } from '@photo-sphere-viewer/gyroscope-plugin';
import { AutorotatePlugin } from '@photo-sphere-viewer/autorotate-plugin';
import { StereoPlugin } from '@photo-sphere-viewer/stereo-plugin';
import '@photo-sphere-viewer/core/index.css';

// parse arguments from the URL
const args = new URLSearchParams(location.search);
const panorama = args.get('panorama') || 'images/pano.jpg';
const lensflaresSettings = {};

new Viewer({
    container: document.querySelector('#viewer') as HTMLElement,
    caption: 'Elia Lazzari <b>&copy; 2023</b>',
    touchmoveTwoFingers: false,
    panorama: panorama,
    mousewheelCtrlKey: true,
    defaultYaw: '130deg',
    navbar: 'autorotate zoom move caption gyroscope stereo fullscreen',
    defaultZoomLvl: 1,
    plugins: [
        [GyroscopePlugin, {
            lang: {
                gyroscope: 'Giroscopio',
            }
        }],
        StereoPlugin,
        [AutorotatePlugin, {
            autorotatePitch: '5deg',
            autostartOnIdle: false
        }],
        [LensflarePlugin, lensflaresSettings]
    ]
});
