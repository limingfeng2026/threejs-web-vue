import{F as e,L as t,P as n,Ut as r,Vt as i,Wt as a,a as o,ct as s,d as c,m as l,p as u,t as d,v as f,z as p}from"./_plugin-vue_export-helper-BO1WDfay.js";import{n as m,r as h,t as g}from"./SceneView-DRBZBOju.js";import{t as ee}from"./SceneLoading-CYid77Xn.js";import{Hr as _,K as v,L as y,Ln as b,R as x,Rr as te,Ur as S,Vn as ne,Wt as C,X as w,aa as re,ca as T,dt as ie,en as E,eo as ae,fr as oe,it as se,lo as ce,pr as le,t as ue,uo as de,xr as fe,za as pe,zn as me}from"./index-BcbeG1I3.js";var he=`
attribute float index;
attribute float current;
uniform float size;
uniform vec3 uColor;
uniform vec3 uColor1;
uniform float uRange;
uniform float uTotal;
uniform float iTime;
varying vec3 vColor;
varying float vOpacity;
void main() {
  float showNumber = uTotal * mod(iTime / 2.0, 1.0);
  float s = size;
  if (showNumber > current && showNumber < current + uRange) {
    vOpacity = 1.0;
    s *= (current + uRange - showNumber) / uRange;
  } else {
    vOpacity = 0.0;
    s = 0.0;
  }
  vColor = mix(uColor, uColor1, index);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = s * 5.0 / (-mvPosition.z);
}
`,ge=`
uniform vec3 uColor;
uniform vec3 uColor1;
varying vec3 vColor;
varying float vOpacity;
void main() {
  gl_FragColor = vec4(vColor, vOpacity);
}
`,_e=`
uniform float uGrow;
varying vec3 vPosition;
varying vec2 vWaveXZ;
#include <fog_pars_vertex>
void main() {
  vPosition = position;
  // 高度生长：z 是楼体的高度轴，按 uGrow 从地面往上长
  vec3 grown = position;
  grown.z *= uGrow;
  vWaveXZ = (modelMatrix * vec4(grown, 1.0)).xz;
  vec4 mvPosition = modelViewMatrix * vec4(grown, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,ve=`
uniform vec3 uBottom;
uniform vec3 uTop;
uniform float uMaxHeight;
uniform float uWaveR;
uniform float uWaveB;
uniform vec2 uWaveC;
uniform float uWaveOn;
uniform float uSweepR;
uniform float uSweepW;
uniform vec3 uSweepColor;
uniform float uSweepOn;
varying vec3 vPosition;
varying vec2 vWaveXZ;
#include <fog_pars_fragment>
void main() {
  float t = clamp(vPosition.z / uMaxHeight, 0.0, 1.0);
  gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
  #include <fog_fragment>
  // 扩散波：只让半径 R 以内的楼体露脸，换主题时从中心往外推开
  if (uWaveOn > 0.5) {
    float d = length(vWaveXZ - uWaveC);
    gl_FragColor.a *= 1.0 - smoothstep(uWaveR - uWaveB, uWaveR + uWaveB, d);
  }
  // 扫光：一条从中心向外扩散的光带，经过的楼体被提亮
  if (uSweepOn > 0.01) {
    float d = length(vWaveXZ - uWaveC);
    float band = 1.0 - smoothstep(0.0, uSweepW, abs(d - uSweepR));
    // 远处（已吃雾）的楼不加重，否则外圈会糊成一片白
    float fade = 1.0;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        fade = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        fade = 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      #endif
    #endif
    gl_FragColor.rgb += uSweepColor * band * uSweepOn * fade;
  }
}
`,ye=`
attribute float aProgress;
varying float vProgress;
#include <fog_pars_vertex>
void main() {
  vProgress = aProgress;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`,be=`
uniform vec3 lineColor;
uniform vec3 hiColor;
uniform float iTime;
uniform float uSpeed;
uniform float uPhase;
uniform float uCount;
uniform float uTail;
uniform float uOpacity;
uniform float uHi;      // 0/1 图例选中：整条线提亮
uniform float uBreath;  // 0..1 呼吸相位
varying float vProgress;
#include <fog_pars_fragment>
void main() {
  float u = vProgress;
  float bestCore = 0.0;
  float bestTail = 0.0;
  for (int k = 0; k < 8; k++) {
    if (float(k) >= uCount) break;
    float head = fract(iTime * uSpeed + uPhase + float(k) / uCount);
    float ahead = fract(u - head);
    float behind = fract(head - u);
    float core = 1.0 - smoothstep(0.0, 0.05, ahead);
    float tailMask = 1.0 - smoothstep(uTail * 0.66, uTail, behind);
    float tail = exp(-behind * 6.5) * tailMask;
    bestCore = max(bestCore, core);
    bestTail = max(bestTail, tail);
  }
  vec3 col = mix(lineColor, hiColor, bestCore);
  // 选中：整条线往白里提 + 呼吸式加成；亮度冲过 1 之后由 bloom 接管，
  // 细线周围自然浮出一圈光晕，就是那条“描边”
  float pulse = uHi * (0.55 + 0.45 * uBreath);
  col = mix(col, vec3(1.0), pulse * 0.55);
  float boost = 1.0 + pulse * 1.9;
  // 线条只有 1px，底噪抬到 0.35 才不会断成一串虚线
  float alpha = clamp(0.35 + bestTail * 0.6 + bestCore * 1.2, 0.0, 1.0);
  // 不吃雾：远景线路保持亮度（材质也设了 fog: false，这里不再手动按雾气衰减）
  gl_FragColor = vec4(col * boost, alpha * uOpacity);
}
`,xe=`
uniform float uWaveR;
uniform float uWaveB;
uniform vec2 uWaveC;
uniform float uWaveOn;
varying vec2 vWaveXZ;
`,D=`
  vWaveXZ = (modelMatrix * vec4(transformed, 1.0)).xz;`,O=`
            if (uWaveOn > 0.5) {
              float d = length(vWaveXZ - uWaveC);
              gl_FragColor.a *= 1.0 - smoothstep(uWaveR - uWaveB, uWaveR + uWaveB, d);
            }`,Se=(e,t=!1)=>`${t?`uniform float uGrow;
`:``}varying vec2 vWaveXZ;\n${e.replace(`#include <begin_vertex>`,`#include <begin_vertex>${t?`
  transformed.z *= uGrow;`:``}${D}`)}`,Ce=e=>`${xe}${e.replace(`#include <dithering_fragment>`,`#include <dithering_fragment>${O}`)}`,we={class:`city-container`},Te={class:`city-switch`},Ee={key:0,class:`poi-detail`},De={class:`pd-cover`},Oe=[`src`],ke={class:`pd-rank`},Ae={class:`pd-head`},je={class:`pd-tags`},Me={key:0},Ne={class:`pd-intro`},Pe={class:`pd-sub`},Fe={class:`pd-sec`},Ie={key:0,class:`pd-sec`},Le={key:1,class:`pd-sec`},Re={class:`pd-foot`},ze={key:1,class:`metro-legend`},Be=[`onClick`],Ve=0,He=0,Ue=`/3d/source/cs_poi.json`,k=.1,We=.011,Ge=1.4,Ke=40,qe=1.2,Je=1.6,Ye=.45,Xe=1800,Ze=.04,Qe=.12,$e=1.006,et=.4,tt=8,nt=22,rt=d({__name:`index`,setup(d){let xe=[16731469,16747008,3526911,65448,16711935,10320895,14548736,65280,16753920,16765952],D=[],O=null,rt=async()=>{let e=await(await fetch(Ue)).json();D=(Array.isArray(e.points)?e.points:[]).map((e,t)=>({...e,img:ue(e.img),lng:+(+e.lng+Ve).toFixed(6),lat:+(+e.lat+He).toFixed(6),color:xe[t%xe.length],time:900+t*80,onMap:e.lat<=Y.north&&e.lat>=Y.south&&e.lng>=Y.west&&e.lng<=Y.east})),O=D.find(e=>e.name.indexOf(`橘子洲`)>=0&&e.onMap)||D.find(e=>e.onMap),O&&(O.hub=!0);let t=D.filter(e=>!e.onMap);t.length&&console.info(`[poi] 落在瓦片范围外的点位：`,t.map(e=>e.name).join(`、`))},it=s(null),A=s(null),at=e=>{A.value=e},j=null,M=null,N=null,ot=0,st=!1,P=`dark`,F=s([]),I=s(-1),ct=e=>{I.value=I.value===e?-1:e},lt=s(!0),L=s(0),ut=0,dt={tiles:60,buildings:25,metro:15},ft=0,pt=0,mt=!1,ht=!1,gt=!1,R=()=>{let e=pt>0?ft/pt*dt.tiles:0;ut=Math.min(100,e+(mt?dt.buildings:0)+(ht?dt.metro:0))},_t=new E,z=new E,vt=new E,B=new E,yt=[],bt=[],xt=e=>{B.traverse(t=>{let n=t.material;if(!n||!(`blending`in n))return;let r=e?1:2;n.blending!==r&&(n.blending=r,n.needsUpdate=!0)})},V=null,St=(e,t)=>{let n=e.distanceTo(t)/3,r=new ne(e,t).getPoints(120),i=new de(r[40].x,r[40].y+n,r[40].z),a=new de(r[80].x,r[80].y+n,r[80].z);return new ie(e,i,a,t)},Ct=e=>{let t=e.getPoints(150),n=[],r=[],i=new w;t.forEach((e,t)=>{i.setHSL(.81666+t*.0025,.88,.88),n.push(e.x,e.y,e.z),r.push(i.r,i.g,i.b)});let a=new x;a.setAttribute(`position`,new C(n,3)),a.setAttribute(`color`,new C(r,3));let o=new me({vertexColors:!0,transparent:!0,opacity:.35});return new b(a,o)},wt=e=>{let t=e.getPoints(120),n=[],r=[],i=[];t.forEach((e,a)=>{n.push(e.x,e.y,e.z),r.push(a/(t.length-1)),i.push(a)});let a=new x;a.setAttribute(`position`,new C(n,3)),a.setAttribute(`index`,new C(r,1)),a.setAttribute(`current`,new C(i,1));let o=new T({uniforms:{iTime:{value:0},size:{value:8},uRange:{value:30},uTotal:{value:t.length},uColor:{value:new w(65535)},uColor1:{value:new w(16711935)}},transparent:!0,depthTest:!0,blending:2,vertexShader:he,fragmentShader:ge});return yt.push(o),new _(a,o)},Tt=()=>{D.forEach((e,t)=>{if(!e.onMap)return;let n=j.projectToScene(e.lng,e.lat,k),r=new se(.1,.22,4,1,!1),i=new le({color:new w(e.color),transparent:!0,depthTest:!0,side:2,blending:2}),a=new oe(r,i);a.rotation.z=Math.PI;let o=document.createElement(`div`);o.className=`poi-card`,o.style.setProperty(`--poi`,`#`+new w(e.color).getHexString());let s=[e.level,e.score?e.score+`分`:``,e.price].filter(Boolean).join(` · `);o.innerHTML=`<span class="poi-rank"><b>`+String(e.rank).padStart(2,`0`)+`</b></span><div class="poi-thumb"><img src="`+e.img+`" alt="" draggable="false"></div><div class="poi-body"><div class="poi-name">`+e.name+`</div><div class="poi-meta">`+s+`</div></div>`;let c=j.createText({element:o,className:`poi-card`,type:`3ds`});o.style.cursor=`pointer`,o.addEventListener(`click`,t=>{t.stopPropagation(),at(e)}),c.scale.set(We,We,We),c.position.set(0,.5+t%3*.55,0);let l=new E;l.add(a),l.add(c),l.position.copy(n),l.userData={cone:a,tip:c,point:e};let u=k;a.position.y=u;let d=new m.Tween(a.position,!0).to({y:.22},e.time).easing(m.Easing.Quadratic.InOut),f=new m.Tween(a.position,!0).to({y:u},e.time).easing(m.Easing.Quadratic.InOut);d.start(),d.chain(f),f.chain(d);let p=new m.Tween(a.rotation,!0).to({y:Math.PI*2},e.time*5),h=new m.Tween(a.rotation,!0).to({y:0},e.time*5);p.start(),p.chain(h),h.chain(p),_t.add(l)}),M.add(_t)},Et=()=>{if(!O)return;let e=j.projectToScene(O.lng,O.lat,k);D.forEach(t=>{if(t.hub||!t.onMap)return;let n=j.projectToScene(t.lng,t.lat,k),r=St(n,e);z.add(Ct(r)),z.add(wt(r))}),M.add(z)},Dt=new ce(0,0),Ot=()=>({uWaveR:{value:Ke},uWaveB:{value:qe},uWaveC:{value:Dt},uWaveOn:{value:0}}),H={dark:Ot(),sat:Ot()},U={sci:Ot(),real:Ot()},kt=new w(729649),At=new w(13230830),jt=new w,Mt=new w,Nt={heightScale:.004,minHeight:.05,maxHeight:.9},Pt={delay:.5,duration:1.6},W={color:16777215,width:2,radius:44,duration:3,interval:4,intensity:.5},Ft={value:0},G={uSweepR:{value:0},uSweepW:{value:W.width},uSweepColor:{value:new w(W.color)},uSweepOn:{value:0}},It=(()=>{let e=new T({uniforms:ae.merge([h.fog,{uBottom:{value:new w(725088)},uTop:{value:new w(2795716)},uMaxHeight:{value:Nt.maxHeight}}]),fog:!0,side:2,depthWrite:!0,transparent:!0,vertexShader:_e,fragmentShader:ve});return e.uniforms.uWaveR=U.sci.uWaveR,e.uniforms.uWaveB=U.sci.uWaveB,e.uniforms.uWaveC=U.sci.uWaveC,e.uniforms.uWaveOn=U.sci.uWaveOn,e.uniforms.uGrow=Ft,e.uniforms.uSweepR=G.uSweepR,e.uniforms.uSweepW=G.uSweepW,e.uniforms.uSweepColor=G.uSweepColor,e.uniforms.uSweepOn=G.uSweepOn,e})(),Lt=new fe({color:10134703,roughness:.85,metalness:.06,fog:!0,side:2,transparent:!0});Lt.onBeforeCompile=e=>{e.uniforms.uWaveR=U.real.uWaveR,e.uniforms.uWaveB=U.real.uWaveB,e.uniforms.uWaveC=U.real.uWaveC,e.uniforms.uWaveOn=U.real.uWaveOn,e.uniforms.uGrow=Ft,e.vertexShader=Se(e.vertexShader,!0),e.fragmentShader=Ce(e.fragmentShader)};let K=null,q=null,Rt=()=>{V=new Worker(new URL(`/threejs-web-vue/assets/buildings.worker-Dq7qjlNl.js`,``+import.meta.url),{type:`module`}),V.postMessage({url:`/3d/source/cs_city_full.json`,center:[112.96,28.195],worldScale:.0012,heightScale:Nt.heightScale,minHeight:Nt.minHeight,maxHeight:Nt.maxHeight}),V.onmessage=e=>{let t=e.data;if(st||!t||t.error){V?.terminate(),V=null;return}let n=new x;if(n.setAttribute(`position`,new y(new Float32Array(t.position),3)),n.setAttribute(`normal`,new y(new Float32Array(t.normal),3)),t.uv&&n.setAttribute(`uv`,new y(new Float32Array(t.uv),2)),t.index){let e=t.indexType===`uint32`?Uint32Array:Uint16Array;n.setIndex(new y(new e(t.index),1))}K=new oe(n,It),q=new oe(n,Lt),[K,q].forEach((e,t)=>{e.rotateX(-Math.PI/2),e.renderOrder=t+1,vt.add(e)}),K.visible=P===`dark`,q.visible=P===`sat`,M.add(vt),mt=!0,R(),V.terminate(),V=null},V.onerror=e=>{console.error(`[building worker]`,e),mt=!0,R(),V?.terminate(),V=null}},zt=async()=>{let e=await(await fetch(`/3d/source/cs_dt.json`)).json();if(st)return;let t=[],n=new Map;if(F.value=[],(e.l||[]).forEach((r,i)=>{let a=(r.st||[]).map(e=>{let[t,r]=String(e.sl).split(`,`).map(Number);if(Number.isNaN(t)||Number.isNaN(r))return null;let{x:a,y:o}=j.projectPlane(t,r);if(e.n){let t=n.get(e.n);t?t.lines.add(i):n.set(e.n,{name:e.n,x:a,y:o,lines:new Set([i])})}return new de(a,Ze,-o)}).filter(Boolean);if(a.length<2)return;let o=new v(a,!1,`catmullrom`,.1),s=Math.max(160,a.length*24),c=o.getPoints(s),l=new Float32Array(c.length),u=0;for(let e=1;e<c.length;e++)u+=c[e].distanceTo(c[e-1]),l[e]=u;if(u>0)for(let e=0;e<l.length;e++)l[e]/=u;let d=new x().setFromPoints(c);d.setAttribute(`aProgress`,new y(l,1));let f=new T({uniforms:{lineColor:{value:new w(`#`+r.cl)},hiColor:{value:new w(16777215)},iTime:{value:0},uSpeed:{value:.18},uPhase:{value:i/Math.max(1,e.l.length)},uCount:{value:2},uTail:{value:.5},uOpacity:{value:.95},uHi:{value:0},uBreath:{value:0}},fog:!1,transparent:!0,depthWrite:!1,depthTest:!1,blending:2,vertexShader:ye,fragmentShader:be});f.userData.legendIndex=F.value.length,F.value.push({name:r.ln,color:`#`+r.cl}),bt.push(f);let p=new b(d,f);p.renderOrder=8,B.add(p),t.push(...a)}),t.length){let e=new x().setFromPoints(t),n=new _(e,new S({color:16777215,size:.06,sizeAttenuation:!0,transparent:!0,opacity:.9,depthTest:!1}));n.renderOrder=9,B.add(n)}n.forEach(({name:e,x:t,y:n,lines:r})=>{let i=r.size>1,a=document.createElement(`div`);a.className=i?`metro-hub`:`metro-tip`,i?(a.title=e+`（换乘站）`,a.innerHTML=`<i>⇄</i><span>`+e+`</span>`):a.innerText=e;let o=j.createText({element:a,className:a.className,type:`3ds`}),s=i?.0058:.005;o.scale.set(s,s,s),o.position.set(t,Qe,-n),B.add(o)}),M.add(B),ht=!0,R()},J={dark:{dir:`/tiles-ofm`,zoom:14,xMin:13324,xMax:13343,yMin:6843,yMax:6859,ext:`.png`,opacity:.95},sat:{dir:`/tiles-sat`,zoom:13,xMin:6662,xMax:6671,yMin:3421,yMax:3429,ext:`.jpg`,opacity:1}},Bt=(e,t)=>e/2**t*360-180,Vt=(e,t)=>180/Math.PI*Math.atan(Math.sinh(Math.PI-2*Math.PI*e/2**t)),Y={west:Bt(J.dark.xMin,J.dark.zoom),east:Bt(J.dark.xMax+1,J.dark.zoom),north:Vt(J.dark.yMin,J.dark.zoom),south:Vt(J.dark.yMax+1,J.dark.zoom)},X={},Ht=e=>{let{zoom:t,xMin:n,xMax:r,yMin:i,yMax:a,dir:o,ext:s,opacity:c}=J[e],l=new pe,u=new E,d=H[e],f=0,p=e===`dark`;u.userData.ready=!1;let m=()=>{--f,p&&(ft+=1,R()),f<=0&&(u.userData.ready=!0)},h=(e,t)=>j.projectPlane(e,t),g=Y;for(let e=n;e<=r;e++){let n=Bt(e,t),r=Bt(e+1,t),ee=Math.max(n,g.west),_=Math.min(r,g.east);if(!(_<=ee))for(let v=i;v<=a;v++){let i=Vt(v,t),a=Vt(v+1,t),y=Math.min(i,g.north),b=Math.max(a,g.south);if(y<=b)continue;let x=h(ee,b),S=h(_,y),ne=S.x-x.x,C=S.y-x.y,w=(ee-n)/(r-n),T=(_-n)/(r-n),ie=(b-a)/(i-a),E=(y-a)/(i-a);f+=1,p&&(pt+=1);let ae=l.load(`${o}/${t}/${e}_${v}${s}`,m,void 0,m);ae.colorSpace=re;let se=new le({map:ae,transparent:!0,opacity:c,depthWrite:!1,fog:!0});se.onBeforeCompile=e=>{e.uniforms.uWaveR=d.uWaveR,e.uniforms.uWaveB=d.uWaveB,e.uniforms.uWaveC=d.uWaveC,e.uniforms.uWaveOn=d.uWaveOn,e.vertexShader=Se(e.vertexShader),e.fragmentShader=Ce(e.fragmentShader)};let ce=new te(ne*$e,C*$e);if(w>0||T<1||ie>0||E<1){let e=ce.attributes.uv;for(let t=0;t<e.count;t++)e.setXY(t,w+(T-w)*e.getX(t),ie+(E-ie)*e.getY(t));e.needsUpdate=!0}let ue=new oe(ce,se);ue.rotateX(-Math.PI/2),ue.position.set((x.x+S.x)/2,.02,-(x.y+S.y)/2),u.add(ue)}}return M.add(u),u.renderOrder=0,X[e]=u,f<=0&&(u.userData.ready=!0),u},Z=s(!1),Q=null,$=null,Ut=e=>{jt.copy(kt).lerp(At,e),M.background&&M.background.isColor&&M.background.copy(jt)},Wt=()=>{M.fog&&(M.fog.near=tt,M.fog.far=nt)},Gt=e=>{M.fog&&M.fog.color&&(Mt.copy(kt).lerp(At,e),M.fog.color.copy(Mt))},Kt=()=>{if(!Q)return;let e=Q.next===`sat`;P=Q.next,Z.value=e;for(let e of[`dark`,`sat`])H[e].uWaveR.value=Ke,H[e].uWaveOn.value=0;for(let e of[`sci`,`real`])U[e].uWaveR.value=Ke,U[e].uWaveOn.value=0;Ut(+!!e),Wt(),Gt(+!!e),B.visible=!0,z.visible=!e,xt(e),j.bloomPass&&(e?($=null,j.bloomPass.strength=0,j.bloomPass.enabled=!1):(j.bloomPass.enabled=!0,$={from:j.bloomPass.strength??0,to:et,t:0})),Q=null},qt=e=>{if(!j||!M||(Q&&Kt(),e===P))return;let t=e===`sat`;t&&!X.sat&&Ht(`sat`);let n=X[t?`sat`:`dark`],r=X[t?`dark`:`sat`];if(!n||!r)return;if(Z.value=t,n.visible=!0,n.renderOrder=-1,r.visible=!0,r.renderOrder=-2,H.sat.uWaveOn.value=+!!t,H.dark.uWaveOn.value=+!t,H.sat.uWaveR.value=0,H.dark.uWaveR.value=0,K&&q){let e=t?q:K,n=t?K:q;e.visible=!0,n.visible=!0,e.renderOrder=2,n.renderOrder=1,U.real.uWaveOn.value=+!!t,U.sci.uWaveOn.value=+!t,U.real.uWaveR.value=0,U.sci.uWaveR.value=0}j.dirLight&&(j.dirLight.intensity=t?1.15:.5),j.ambLight&&(j.ambLight.intensity=t?.85:.5),t&&(z.visible=!1),xt(t),document.body.classList.toggle(`cm-sat`,t);let i=!1;if(t&&j.bloomPass){let e=j.bloomPass,t=e.enabled?e.strength??et:0;e.enabled=!0,t>.001?($={from:t,to:0,t:0},i=!0):(e.strength=0,e.enabled=!1)}Q={next:e,t:0,waitBloom:i,waiting:!n.userData.ready}},Jt=e=>{if(!Q)return;if(Q.waitBloom){if($)return;Q.waitBloom=!1,Q.t=0}let t=X[Q.next===`sat`?`sat`:`dark`];if(Q.waiting){if(!t||!t.userData.ready)return;Q.waiting=!1,Q.t=0}Q.t=Math.min(1,Q.t+Math.min(e,.05)/Ge);let n=Q.t**+Je,r=Ke*n;H.dark.uWaveR.value=r,H.sat.uWaveR.value=r,U.sci.uWaveR.value=r,U.real.uWaveR.value=r;let i=Q.next===`sat`;Ut(i?n:1-n),Gt(i?n:1-n),Q.t>=1&&Kt()},Yt=e=>{if(!$||!j?.bloomPass)return;let t=j.bloomPass;$.t=Math.min(1,$.t+Math.min(e,.05)/Ye);let n=$.t*$.t*(3-2*$.t);t.strength=$.from+($.to-$.from)*n,$.t>=1&&(t.strength=$.to,t.enabled=$.to>0,$=null)},Xt=0,Zt=0,Qt=e=>1-(1-e)**3,$t=e=>{if(!gt)return;Xt+=e;let t=Xe/1e3+Pt.delay,n=Math.min(1,Math.max(0,(Xt-t)/Pt.duration));if(Ft.value=Qt(n),P===`dark`&&n>=1){Zt+=e;let t=Zt%W.interval;t<W.duration?(G.uSweepOn.value=W.intensity,G.uSweepR.value=W.radius*(t/W.duration)):G.uSweepOn.value=0}else G.uSweepOn.value=0},en=e=>{if(ot+=e,lt.value){let t=Math.min(1,e*6),n=L.value;L.value=Math.max(n,n+(ut-n)*t),ut<100&&L.value>70&&(L.value+=(98.7-L.value)*Math.min(1,e*.6)),L.value>100&&(L.value=100),ut>=100&&L.value>=99.5&&(L.value=100,lt.value=!1,!gt&&j&&N&&(gt=!0,j.flyTo(N.position,{x:0,y:6,z:10},1800)))}if(!M)return;$t(e),Jt(e),Yt(e),yt.forEach(e=>{e.uniforms.iTime.value=ot});let t=I.value;bt.forEach(n=>{n.uniforms.iTime.value=ot;let r=n.userData.legendIndex===t,i=n.userData.hi||0;n.userData.hi=i+(+!!r-i)*Math.min(1,e*9),n.uniforms.uHi.value=n.userData.hi,n.uniforms.uBreath.value=.5+.5*Math.sin(ot*3.2),n.uniforms.uOpacity.value=t>=0?r?1:.4:.95})};return n(async()=>{j=new g(it.value,{mode:``,bgColor:729649,environment:!1,shadowMapEnabled:!1,floor:{enabled:!1},fog:{enabled:!0,color:729649,near:8,far:22},ambLight:{enabled:!0,color:4210752,intensity:.5},dirLight:{enabled:!0,color:16777215,intensity:.5,position:{x:0,y:30,z:50}},control:{enabled:!0,enableDamping:!0,dampingFactor:.3,zoomSpeed:2,minDistance:1,maxDistance:16,minPolarAngle:-Math.PI/2,maxPolarAngle:Math.PI/2.2,panLimit:{enabled:!0,min:{x:-10,z:-10},max:{x:20,z:10}}},geo:{center:[112.96,28.195],worldScale:.0012},postProcessing:{enabled:!0,smaa:{enabled:!0},gtao:{enabled:!1},bloom:{enabled:!0,strength:.4,radius:.35,threshold:.4},vignette:{enabled:!0,darkness:.75,offset:1.6},film:{enabled:!1},bokeh:{enabled:!1},outline:{enabled:!1}}}),M=j.scene,N=j.camera,N.position.set(0,34,30);try{await rt()}catch(e){console.warn(`[poi] 点位数据加载失败`,e)}Tt(),Et(),Ht(`dark`),Rt(),zt().finally(()=>{ht=!0,R()}),j.animateCallback=en,j.start()}),e(()=>{st=!0,document.body.classList.remove(`cm-sat`),V?.terminate(),V=null,j&&=(j.clear(),null),M=null,N=null}),(e,n)=>(t(),l(`div`,we,[c(`div`,{ref_key:`container`,ref:it,class:`city-canvas-wrap`},null,512),f(ee,{visible:lt.value,progress:L.value,brand:`CITY MAP`,title:`长沙城市模型载入`,status:`正在加载瓦片底图 · 楼体与地铁线路构建中`,accent:`#4fd1ff`,accent2:`#7cf7c4`},null,8,[`visible`,`progress`]),n[7]||=c(`div`,{class:`city-header`},[c(`h3`,null,`长沙 TOP10 景点`),c(`span`,null,`热度排名 · 实景缩略图 · 评级/评分/票价 · 汇聚飞线`)],-1),c(`div`,Te,[c(`button`,{class:i([`theme-btn`,Z.value?`is-sat`:`is-dark`]),onClick:n[0]||=e=>qt(Z.value?`dark`:`sat`)},a(Z.value?`深色背景`:`卫星背景`),3)]),A.value?(t(),l(`aside`,Ee,[c(`button`,{class:`pd-close`,onClick:n[1]||=e=>A.value=null},`×`),c(`div`,De,[c(`img`,{src:A.value.img,alt:``},null,8,Oe),c(`span`,ke,`TOP `+a(A.value.rank),1)]),c(`div`,Ae,[c(`h4`,null,a(A.value.name),1),c(`div`,je,[A.value.level?(t(),l(`span`,Me,a(A.value.level),1)):u(``,!0),c(`span`,null,a(A.value.score)+` 分`,1),c(`span`,null,a(A.value.price),1)]),c(`p`,Ne,a(A.value.intro),1),c(`p`,Pe,a(A.value.comments)+` 条评论 · `+a(A.value.open),1)]),c(`section`,Fe,[n[2]||=c(`h5`,null,`景点特色`,-1),c(`p`,null,a(A.value.features),1)]),A.value.plays&&A.value.plays.length?(t(),l(`section`,Ie,[n[3]||=c(`h5`,null,`好玩项目`,-1),c(`ul`,null,[(t(!0),l(o,null,p(A.value.plays,e=>(t(),l(`li`,{key:e},a(e),1))),128))])])):u(``,!0),A.value.foods&&A.value.foods.length?(t(),l(`section`,Le,[n[4]||=c(`h5`,null,`美食推荐`,-1),c(`ul`,null,[(t(!0),l(o,null,p(A.value.foods,e=>(t(),l(`li`,{key:e},a(e),1))),128))])])):u(``,!0),c(`div`,Re,`地址：`+a(A.value.addr),1)])):u(``,!0),F.value.length?(t(),l(`div`,ze,[n[6]||=c(`div`,{class:`ml-head`},`地铁线路`,-1),(t(!0),l(o,null,p(F.value,(e,o)=>(t(),l(`button`,{key:e.name,class:i([`ml-item`,{active:I.value===o}]),style:r({"--line":e.color}),onClick:e=>ct(o)},[n[5]||=c(`i`,{class:`ml-bar`},null,-1),c(`span`,null,a(e.name),1)],14,Be))),128))])):u(``,!0)]))}},[[`__scopeId`,`data-v-57d09547`]]);export{rt as default};