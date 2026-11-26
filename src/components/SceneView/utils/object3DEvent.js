import {
    Raycaster,
    Vector2,
    Object3D
} from 'three'

var eventList = []
var lastObj = null
var lastTarget = null
var _pendingHover = false     // ★ rAF 节流标记
var _lastMouseX = -99999     // ★ 上次鼠标 X
var _lastMouseY = -99999     // ★ 上次鼠标 Y
var _skipThreshold = 1       // ★ 像素阈值，小于此值视为没移动

class Event {
    constructor(element, scene, camera, isRayAll = true) {
        this.element = element
        this.width = element.clientWidth
        this.height = element.clientHeight
        this.camera = camera
        this.scene = scene
        this.isRayAll = isRayAll
        this.raycaster = new Raycaster()
        this.mouse = new Vector2()
        this.mouseDownPoint = new Vector2()
        Object3D.prototype.on = this.object3DEvent
        Object3D.prototype.off = this.removeEvent
        Object3D.prototype.offAll = this.removeAll

        // ★ 保存绑定后的处理器，dispose 时才能真正解绑（原实现只 clear 数据、监听仍留在 DOM 上）
        this._handlers = []
        const bindMouse = (type) => {
            const handler = (e) => this.mouseEvent(type, e)
            element.addEventListener(type, handler, false)
            this._handlers.push([type, handler])
        }
        bindMouse('mousedown')
        bindMouse('mouseup')
        bindMouse('click')
        bindMouse('dblclick')
        const hoverHandler = (e) => this.mouseHover(e)
        element.addEventListener('mousemove', hoverHandler, false)
        this._handlers.push(['mousemove', hoverHandler])
    }

    // 切换场景 / 相机时由 SceneSwitcher 调用
    setScene(scene) {
        this.scene = scene
    }

    setCamera(camera) {
        this.camera = camera
    }

    // 设置事件对象
    object3DEvent(type, callBack, callBack1) {
        eventList.push({ type, callBack, callBack1, object: this, sceneUuid: this.scene?.uuid })
    }

    // 移除object3D对象事件
    removeEvent(type) {
        let index = null
        eventList.forEach((ele, i) => {
           if (ele.type === type && this.uuid === ele.object.uuid) {
                index = i
           }
        })
        if (index !== null) {
            eventList.splice(index, 1)
        }
    }

    // 移除object3D对象的所有事件
    removeAll() {
        eventList = eventList.filter(ele => this.uuid !== ele.object.uuid)
    }

    // 鼠标事件
    mouseEvent(clickType, event) {
        const evt = event || (typeof window !== 'undefined' ? window.event : null)
        if (!evt) return
        evt.preventDefault()
        // 判断鼠标按下事件是否移动鼠标，移动鼠标不触发mouseup事件。
        if(clickType == 'mousedown') {
            this.mouseDownPoint.x = this.mouse.x
            this.mouseDownPoint.y = this.mouse.y
        }
        if(clickType == 'mouseup') {
            let d = this.mouseDownPoint.distanceTo(this.mouse)
            if(d > 0) return false
        }
        const mousedownList = eventList.filter(item => item.type === clickType)
        if (mousedownList.length === 0) return
        this.mouse.x = (evt.offsetX / this.width) * 2 - 1
        this.mouse.y = -(evt.offsetY / this.height) * 2 + 1
        const list = this.isRayAll ? this.scene.children : mousedownList.map(item => item.object)

        // 通过摄像机和鼠标位置更新射线
        this.raycaster.setFromCamera(this.mouse, this.camera)
        // 计算物体和射线的焦点
        var intersects = this.raycaster.intersectObjects(list, true).filter(item => item.object.visible)
        if (intersects.length > 0) {
            const target = intersects[0].object
            const obj = this.getEventObj(target, mousedownList)

            if (!!obj && obj.type === clickType) {
                obj.callBack(obj.object, target, intersects[0].point)
            }
        }
    }

    // hover事件（带 rAF 节流 + 鼠标位移检测）
    mouseHover(event) {
        const mx = event.offsetX;
        const my = event.offsetY;
        // ★ 鼠标没怎么动就跳过，避免无意义的射线检测
        if (Math.abs(mx - _lastMouseX) < _skipThreshold && Math.abs(my - _lastMouseY) < _skipThreshold) return;
        _lastMouseX = mx;
        _lastMouseY = my;
        // ★ rAF 节流：同一帧多次触发只处理一次
        if (_pendingHover) return;
        _pendingHover = true;
        requestAnimationFrame(() => {
            _pendingHover = false;
            this._doHover(event, mx, my);
        });
    }

    _doHover(event, mx, my) {
		event.preventDefault()
        const mouseHoverList = eventList.filter(item => item.type === 'hover')
        if (mouseHoverList.length === 0) return

        this.mouse.x = (mx / this.width) * 2 - 1
        this.mouse.y = -(my / this.height) * 2 + 1
        const list = this.isRayAll ? this.scene.children : mouseHoverList.map(item => item.object)
        this.raycaster.setFromCamera(this.mouse, this.camera)
        var intersects = this.raycaster.intersectObjects(list.filter(item => item.visible), true)
        if (intersects.length > 0) {
            const target = intersects[0].object
            const active = this.getEventObj(target, mouseHoverList)
            if (!!active && active.type === 'hover') {
                if (lastObj === null || lastObj.object.uuid !== active.object.uuid) {
                    if (lastObj !== null && lastObj.callBack1 !== undefined) lastObj.callBack1(lastObj.object, lastTarget)
                    lastObj = active;
                    lastTarget = target;
                    active.callBack(active.object, target)
                }
            } else if (lastObj !== null) {
                if (lastObj.callBack1 !== undefined) lastObj.callBack1(lastObj.object, lastTarget)
                lastObj = null
            }
        } else if (lastObj !== null) {
            if (lastObj.callBack1 !== undefined) lastObj.callBack1(lastObj.object, lastTarget)
            lastObj = null
        }
    }

    // 获取事件对象
    getEventObj(target, list) {
        const uuid = [target.uuid]

        target.traverseAncestors(parent => {
           if (!parent.isScene) uuid.push(parent.uuid)
        })

        const object = list.find(item => uuid.includes(item.object.uuid))

        return object
    }

    // 重置事件元素长宽
    resize() {
        this.width = this.element.clientWidth
        this.height = this.element.clientHeight
    }

    // 清空
    clear() {
        eventList = []
        lastObj = null
        lastTarget = null
        _pendingHover = false
        _lastMouseX = -99999
        _lastMouseY = -99999
    }

    // 彻底销毁：解绑 DOM 监听并清空事件表
    dispose() {
        if (this._handlers) {
            for (const [type, handler] of this._handlers) {
                this.element.removeEventListener(type, handler, false)
            }
            this._handlers = null
        }
        this.clear()
        this.scene = null
        this.camera = null
    }
}

export default Event