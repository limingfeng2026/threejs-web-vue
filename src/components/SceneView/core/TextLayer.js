/**
 * 文本层：CSS2D / CSS3D（精灵、平面）以及真正的 3D 字体网格
 *
 * 与原实现保持同样的 DOM 结构与层级（2D zIndex 1，3D zIndex 2，均不拦截鼠标），
 * 但把字体加载、字符串入参、TextGeometry 参数等历史坑补齐。
 */
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CSS3DRenderer, CSS3DObject, CSS3DSprite } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export class TextLayer {
    constructor(container) {
        this.container = container;
        this.fontLoader = new FontLoader();
        this.fontCache = new Map();

        // 2D 文本层
        this.render2d = new CSS2DRenderer();
        Object.assign(this.render2d.domElement.style, {
            position: 'absolute',
            zIndex: 200,
            top: 0,
            left: 0,
            pointerEvents: 'none',
        });
        this.render2d.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.render2d.domElement);

        // 3D 文本层
        this.render3d = new CSS3DRenderer();
        Object.assign(this.render3d.domElement.style, {
            position: 'absolute',
            zIndex: 100,
            top: 0,
            left: 0,
            pointerEvents: 'none',
        });
        this.render3d.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.render3d.domElement);
    }

    /**
     * 创建文本对象
     * @param {object} options
     * @param {string|HTMLElement} options.element 文本内容或已构建的 DOM
     * @param {string} [options.className] 字符串入参时的 class
     * @param {'2d'|'3d'|'3ds'|'3d-font'} [options.type]
     * @param {string} [options.color]
     * @param {{x:number,y:number,z:number}|THREE.Vector3} [options.position]
     * @param {string} [options.fontUrl] 3d-font 的 typeface.json 地址
     * @param {number} [options.size] 3d-font 字号
     * @param {number} [options.depth] 3d-font 厚度
     * @returns {THREE.Object3D|Promise<THREE.Mesh>|null}
     */
    create({ element, className, type = '2d', depthTest = true, color, position = { x: 0, y: 0, z: 0 }, fontUrl, size = 1, depth = 0.1 } = {}) {
        const targetPosition = new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);

        if (type === '3d-font') {
            return this._createTextGeometry({
                text: this._extractText(element),
                color,
                position: targetPosition,
                fontUrl,
                size,
                depth,
            });
        }

        const isElement = element instanceof HTMLElement;
        let dom = element;
        if (!isElement) {
            dom = document.createElement('div');
            dom.className = className || 'text_element';
            // 保持原行为：字符串按 HTML 解析，方便外部塞富文本
            dom.innerHTML = element == null ? '' : String(element);
        }
        if (color) dom.style.color = color;

        let object = null;
        switch (type) {
            case '2d':
                object = new CSS2DObject(dom);
                break;
            case '3ds':
                object = new CSS3DSprite(dom);
                break;
            case '3d':
                object = new CSS3DObject(dom);
                break;
            default:
                return null;
        }

        object.position.copy(targetPosition);
        if (depthTest === false) object.userData.depthTest = false;
        return object;
    }

    /** 字符串 / DOM 统一取纯文本 */
    _extractText(element) {
        if (typeof element === 'string') return element;
        if (element && typeof element.textContent === 'string') return element.textContent;
        return '';
    }

    /** 加载并缓存字体 */
    _loadFont(url) {
        if (this.fontCache.has(url)) return this.fontCache.get(url);
        const promise = new Promise((resolve, reject) => {
            this.fontLoader.load(url, resolve, undefined, reject);
        });
        this.fontCache.set(url, promise);
        return promise;
    }

    /** 真正的挤出字体网格 */
    async _createTextGeometry({ text, color, position, fontUrl, size, depth }) {
        const url = fontUrl || '/font/gentilis_regular.typeface.json';
        let font = null;
        try {
            font = await this._loadFont(url);
        } catch (error) {
            console.warn(`[SceneView] 字体加载失败，无法创建 3D 字体：${url}`, error);
            return null;
        }

        // r163 起 TextGeometry 的厚度参数是 depth（height 已废弃）
        const geometry = new TextGeometry(text, {
            font,
            size,
            depth,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
        });
        geometry.computeBoundingBox();

        const material = new THREE.MeshPhongMaterial({ color: new THREE.Color(color || 0xffffff) });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        return mesh;
    }

    /** 渲染两层文本（在 WebGL 渲染之后调用） */
    render(scene, camera) {
        if (this.render2d) this.render2d.render(scene, camera);
        if (this.render3d) this.render3d.render(scene, camera);
    }

    resize(width, height) {
        if (this.render2d) this.render2d.setSize(width, height);
        if (this.render3d) this.render3d.setSize(width, height);
    }

    dispose() {
        for (const layer of [this.render2d, this.render3d]) {
            if (layer && layer.domElement && layer.domElement.parentNode) {
                layer.domElement.parentNode.removeChild(layer.domElement);
            }
        }
        this.render2d = null;
        this.render3d = null;
        this.fontCache.clear();
        this.fontLoader = null;
    }
}
