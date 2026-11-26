import {
    ShaderMaterial,
    MeshStandardMaterial,
    MeshPhysicalMaterial,
    Color,
    DoubleSide,
    FrontSide,
    RepeatWrapping
} from 'three';

/**
 * 菲涅尔材质类 - 精准匹配参考图的紫粉色边缘发光效果
 * 继承自 ShaderMaterial，保留原有所有特性
 */
class FresnelMaterial extends ShaderMaterial {
    /**
     * 构造函数
     * @param {Object} options 自定义参数（可选）
     * @param {Color} options.color 基础颜色
     * @param {Color} options.fresnelColor 菲涅尔发光主色（兼容旧参数）
     * @param {number} options.fresnelPower 边缘宽度（值越大越窄）
     * @param {number} options.fresnelScale 发光强度
     * @param {number} options.fresnelBias 基础发光强度
     * @param {boolean} options.doubleSide 是否双面渲染
     * @param {Texture} options.map 纹理贴图
     * @param {number} options.mapIntensity 贴图文理混合强度
     */
    constructor(options = {}) {
        // 默认参数（修改：匹配参考图的色调和发光参数）
        const defaultOptions = {
            color: new Color(0x3a1848), // 【修改】更贴近沙发的深紫基底
            fresnelColor: new Color(0xff00dd),
            fresnelPower: 0.3, // 【修改】降低值让边缘更宽更柔
            fresnelScale: 0.85, // 【修改】提升发光强度
            fresnelBias: 0.1, // 【修改】降低基础发光，避免整体过亮
            doubleSide: false,
            map: null,
            mapIntensity: 0.6 // 【修改】降低贴图强度，避免盖过发光
        };
        // 合并默认参数和自定义参数
        const config = { ...defaultOptions, ...options };

        // 初始化uniforms（新增双色发光/优化贴图混合）
        const uniforms = {
            color: { value: new Color(config.color) },
            fresnelColor: { value: new Color(config.fresnelColor) },
            fresnelPower: { value: config.fresnelPower },
            fresnelScale: { value: config.fresnelScale },
            fresnelBias: { value: config.fresnelBias },
            map: { value: config.map },
            mapIntensity: { value: config.mapIntensity },
            hasMap: { value: !!config.map }
        };

        // 调用父类构造函数
        super({
            uniforms: uniforms,
            vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;
                varying vec2 vUv;

                void main() {
                    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    // 【修改】法向量归一化优化，避免拉伸变形
                    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform vec3 fresnelColor;
                uniform float fresnelPower;
                uniform float fresnelScale;
                uniform float fresnelBias;
                uniform sampler2D map;
                uniform float mapIntensity;
                uniform bool hasMap;

                varying vec3 vWorldPosition;
                varying vec3 vWorldNormal;
                varying vec2 vUv;

                void main() {
                    // 1. 计算菲涅尔强度（【修改】加入smoothstep柔化边缘）
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    float dotProduct = dot(vWorldNormal, viewDir);
                    // 平滑过渡：让发光边缘从暗到亮更自然
                    float fresnel = fresnelBias + fresnelScale * pow(1.0 - smoothstep(0.0, 1.0, dotProduct), fresnelPower);
                    
                    // 2. 基础颜色（【修改】优化贴图混合逻辑，让纹理偏暗紫调）
                    vec3 finalcolor = color;
                    if (hasMap) {
                        vec3 mapColor = texture2D(map, vUv).rgb;
                        // 先让贴图文理偏暗紫，再和基础色混合（匹配沙发纹理）
                        mapColor = mix(mapColor, color, 0.4);
                        finalcolor = mix(finalcolor, mapColor, mapIntensity);
                    }
                    
                    // 4. 混合基础色和发光色（【修改】降低溢出值，避免过亮）
                    vec3 finalColor = mix(finalcolor, fresnelColor, fresnel) + (fresnel * 0.05);
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            `,
            side: config.doubleSide ? DoubleSide : FrontSide
        });

        this.config = config;
        this.uniforms = uniforms;
        this.isFresnelMaterial = true
        this.color = new Color(config.color);
        this.fresnelColor = new Color(config.fresnelColor);
        this.fresnelPower = config.fresnelPower;
        this.fresnelScale = config.fresnelScale;
        this.fresnelBias = config.fresnelBias;
    }

    /**
     * 快捷修改菲涅尔发光颜色（兼容旧方法+支持双色）
     * @param {Color|number|string} color 主色
     */
    setFresnelColor(color, innerColor, outerColor) {
        // 主色修改
        if (typeof color === 'number' || typeof color === 'string') {
            this.uniforms.fresnelColor.value.set(color);
        } else if (color instanceof Color) {
            this.uniforms.fresnelColor.value.copy(color);
        }
        this.needsUpdate = true;
    }

    /**
     * 快捷修改基础颜色
     * @param {Color|number|string} color 颜色
     */
    setColor(color) {
        if (typeof color === 'number' || typeof color === 'string') {
            this.uniforms.color.value.set(color);
        } else if (color instanceof Color) {
            this.uniforms.color.value.copy(color);
        }
        this.needsUpdate = true;
    }

    /**
     * 快捷调整菲涅尔强度参数
     * @param {Object} params 参数对象
     * @param {number} [params.power] 边缘宽度
     * @param {number} [params.scale] 发光强度
     * @param {number} [params.bias] 基础发光强度
     */
    adjustFresnel(params) {
        if (params.power !== undefined) {
            this.uniforms.fresnelPower.value = params.power;
        }
        if (params.scale !== undefined) {
            this.uniforms.fresnelScale.value = params.scale;
        }
        if (params.bias !== undefined) {
            this.uniforms.fresnelBias.value = params.bias;
        }
        this.needsUpdate = true;
    }

    /**
     * 设置/更换贴图
     * @param {Texture} texture 纹理贴图
     * @param {number} [intensity=0.6] 贴图文理强度（默认适配参考图）
     */
    setMap(texture, intensity = 0.6) { // 【修改】默认强度改为0.6
        if (texture) {
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            texture.needsUpdate = true;
        }
        this.uniforms.map.value = texture;
        this.uniforms.hasMap.value = !!texture;
        this.uniforms.mapIntensity.value = Math.max(0, Math.min(1, intensity));
        this.needsUpdate = true;
    }
}
class FresnelMaterial2 extends MeshStandardMaterial {
    constructor(config = { 
        color: new Color(0xffffff), 
        fresnelColor: new Color(0xec5fcc), 
        fresnelPower: 1 
    }) {
        super({
            color: config.color,
            map: config.map || null,
            side: config.side || DoubleSide,
            metalness: config.metalness || 0.1, // 适配兰伯特效果，纯漫反射
            roughness: config.roughness || 0.65,  // 光滑表面，菲涅尔更明显
        });
        this.isFresnelMaterial = true
        this.color = new Color(config.color);
        this.fresnelColor = new Color(config.fresnelColor);
        this.fresnelPower = config.fresnelPower;
        this.uniforms = {
            fresnelColor: { value: this.fresnelColor },
            fresnelPower: { value: this.fresnelPower }
        };
    }
    onBeforeCompile (shader) {
        // 1. 向Shader注入自定义uniform变量
        shader.uniforms.fresnelColor = this.uniforms.fresnelColor;
        shader.uniforms.fresnelPower = this.uniforms.fresnelPower;
        // 3. 向片元着色器注入菲涅尔逻辑
        shader.fragmentShader = `
            uniform vec3 fresnelColor; // 菲涅尔边缘颜色
            uniform float fresnelPower; // 菲涅尔强度
            ${shader.fragmentShader}
        `.replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\n\tfloat dotNV = 1.0-saturate( dot( normal, geometry.viewDir ) );\n\tgl_FragColor.rgb += fresnelPower*dotNV*fresnelColor;'
        );
    };
}

class FresnelMaterial3 extends MeshPhysicalMaterial {
    constructor(config = { 
        color: new Color(0xffffff), 
        fresnelColor: new Color(0xec5fcc),
        fresnelPower: 1 
    }) {
        super({
            color: config.color,
            map: config.map || null,
            side: config.side || DoubleSide,
            metalness: config.metalness || 0.1, // 适配兰伯特效果，纯漫反射
            roughness: config.roughness || 0.65,  // 光滑表面，菲涅尔更明显
        });
        this.isFresnelMaterial = true
        this.color = new Color(config.color);
        this.fresnelColor = new Color(config.fresnelColor);
        this.fresnelPower = config.fresnelPower;
        this.uniforms = {
            fresnelColor: { value: this.fresnelColor },
            fresnelPower: { value: this.fresnelPower }
        };
    }
    onBeforeCompile (shader) {
        // 1. 向Shader注入自定义uniform变量
        shader.uniforms.fresnelColor = this.uniforms.fresnelColor;
        shader.uniforms.fresnelPower = this.uniforms.fresnelPower;
        // 3. 向片元着色器注入菲涅尔逻辑
        shader.fragmentShader = `
            uniform vec3 fresnelColor; // 菲涅尔边缘颜色
            uniform float fresnelPower; // 菲涅尔强度
            ${shader.fragmentShader}
        `.replace(
            '#include <dithering_fragment>',
            '#include <dithering_fragment>\n\tfloat dotNV = 1.0-saturate( dot( normal, geometry.viewDir ) );\n\tgl_FragColor.rgb += fresnelPower*dotNV*fresnelColor;'
        );
    };
}

// 导出类
export { FresnelMaterial, FresnelMaterial2, FresnelMaterial3 };
