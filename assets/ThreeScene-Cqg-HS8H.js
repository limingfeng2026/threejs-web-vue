import{F as e,L as t,P as n,Vt as r,Z as i,_t as a,ct as o,d as s,m as c,p as l,t as u,u as d,v as f}from"./_plugin-vue_export-helper-BO1WDfay.js";import{r as p,t as m}from"./SceneView-DRBZBOju.js";import{Ir as h,Lr as g,X as _,ca as v,do as y,dr as b,eo as x,fr as S,nn as C,uo as w,vo as T}from"./index-BcbeG1I3.js";import{t as E}from"./SceneLoading-CYid77Xn.js";var D=class extends S{constructor(e,t={}){super(e),this.isWater=!0;let n=this,r=t.textureWidth===void 0?512:t.textureWidth,i=t.textureHeight===void 0?512:t.textureHeight,a=t.clipBias===void 0?0:t.clipBias,o=t.alpha===void 0?1:t.alpha,s=t.time===void 0?0:t.time,c=t.waterNormals===void 0?null:t.waterNormals,l=t.sunDirection===void 0?new w(.70707,.70707,0):t.sunDirection,u=new _(t.sunColor===void 0?16777215:t.sunColor),d=new _(t.waterColor===void 0?8355711:t.waterColor),f=t.eye===void 0?new w(0,0,0):t.eye,m=t.distortionScale===void 0?20:t.distortionScale,S=t.side===void 0?0:t.side,E=t.fog!==void 0&&t.fog,D=new g,O=new w,k=new w,A=new w,j=new b,M=new w(0,0,-1),N=new y,P=new w,F=new w,I=new y,L=new b,R=new h,z=new T(r,i,{type:C}),B={name:`MirrorShader`,uniforms:x.merge([p.fog,p.lights,{normalSampler:{value:null},mirrorSampler:{value:null},alpha:{value:1},time:{value:0},size:{value:1},distortionScale:{value:20},textureMatrix:{value:new b},sunColor:{value:new _(8355711)},sunDirection:{value:new w(.70707,.70707,0)},eye:{value:new w},waterColor:{value:new _(5592405)}}]),vertexShader:`
				uniform mat4 textureMatrix;
				uniform float time;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				#include <common>
				#include <fog_pars_vertex>
				#include <shadowmap_pars_vertex>
				#include <logdepthbuf_pars_vertex>

				void main() {
					mirrorCoord = modelMatrix * vec4( position, 1.0 );
					worldPosition = mirrorCoord.xyzw;
					mirrorCoord = textureMatrix * mirrorCoord;
					vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );
					gl_Position = projectionMatrix * mvPosition;

				#include <beginnormal_vertex>
				#include <defaultnormal_vertex>
				#include <logdepthbuf_vertex>
				#include <fog_vertex>
				#include <shadowmap_vertex>
			}`,fragmentShader:`
				uniform sampler2D mirrorSampler;
				uniform float alpha;
				uniform float time;
				uniform float size;
				uniform float distortionScale;
				uniform sampler2D normalSampler;
				uniform vec3 sunColor;
				uniform vec3 sunDirection;
				uniform vec3 eye;
				uniform vec3 waterColor;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				vec4 getNoise( vec2 uv ) {
					vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
					vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
					vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
					vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
					vec4 noise = texture2D( normalSampler, uv0 ) +
						texture2D( normalSampler, uv1 ) +
						texture2D( normalSampler, uv2 ) +
						texture2D( normalSampler, uv3 );
					return noise * 0.5 - 1.0;
				}

				void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
					vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
					float direction = max( 0.0, dot( eyeDirection, reflection ) );
					specularColor += pow( direction, shiny ) * sunColor * spec;
					diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
				}

				#include <common>
				#include <packing>
				#include <bsdfs>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <lights_pars_begin>
				#include <shadowmap_pars_fragment>
				#include <shadowmask_pars_fragment>

				void main() {

					#include <logdepthbuf_fragment>
					vec4 noise = getNoise( worldPosition.xz * size );
					vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

					vec3 diffuseLight = vec3(0.0);
					vec3 specularLight = vec3(0.0);

					vec3 worldToEye = eye-worldPosition.xyz;
					vec3 eyeDirection = normalize( worldToEye );
					sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );

					float distance = length(worldToEye);

					vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
					vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );

					float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
					float rf0 = 0.02;
					float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
					vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
					vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), reflectionSample + specularLight, reflectance );
					vec3 outgoingLight = albedo;
					gl_FragColor = vec4( outgoingLight, alpha );

					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>	
				}`},V=new v({name:B.name,uniforms:x.clone(B.uniforms),vertexShader:B.vertexShader,fragmentShader:B.fragmentShader,lights:!0,side:S,fog:E});V.uniforms.mirrorSampler.value=z.texture,V.uniforms.textureMatrix.value=L,V.uniforms.alpha.value=o,V.uniforms.time.value=s,V.uniforms.normalSampler.value=c,V.uniforms.sunColor.value=u,V.uniforms.waterColor.value=d,V.uniforms.sunDirection.value=l,V.uniforms.distortionScale.value=m,V.uniforms.eye.value=f,n.material=V,n.onBeforeRender=function(e,t,r){if(k.setFromMatrixPosition(n.matrixWorld),A.setFromMatrixPosition(r.matrixWorld),j.extractRotation(n.matrixWorld),O.set(0,0,1),O.applyMatrix4(j),P.subVectors(k,A),P.dot(O)>0)return;P.reflect(O).negate(),P.add(k),j.extractRotation(r.matrixWorld),M.set(0,0,-1),M.applyMatrix4(j),M.add(A),F.subVectors(k,M),F.reflect(O).negate(),F.add(k),R.position.copy(P),R.up.set(0,1,0),R.up.applyMatrix4(j),R.up.reflect(O),R.lookAt(F),R.far=r.far,R.updateMatrixWorld(),R.projectionMatrix.copy(r.projectionMatrix),L.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),L.multiply(R.projectionMatrix),L.multiply(R.matrixWorldInverse),D.setFromNormalAndCoplanarPoint(O,k),D.applyMatrix4(R.matrixWorldInverse),N.set(D.normal.x,D.normal.y,D.normal.z,D.constant);let i=R.projectionMatrix;I.x=(Math.sign(N.x)+i.elements[8])/i.elements[0],I.y=(Math.sign(N.y)+i.elements[9])/i.elements[5],I.z=-1,I.w=(1+i.elements[10])/i.elements[14],N.multiplyScalar(2/N.dot(I)),i.elements[2]=N.x,i.elements[6]=N.y,i.elements[10]=N.z+1-a,i.elements[14]=N.w,f.setFromMatrixPosition(r.matrixWorld);let o=e.getRenderTarget(),s=e.xr.enabled,c=e.shadowMap.autoUpdate;n.visible=!1,e.xr.enabled=!1,e.shadowMap.autoUpdate=!1,e.setRenderTarget(z),e.state.buffers.depth.setMask(!0),e.autoClear===!1&&e.clear(),e.render(t,R),n.visible=!0,e.xr.enabled=s,e.shadowMap.autoUpdate=c,e.setRenderTarget(o);let l=r.viewport;l!==void 0&&e.state.viewport(l)}}},O={class:`sence-container`},k=u({__name:`ThreeScene`,setup(u){let p=o(null),h=o(0),g=null,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=null,T=null,k=o(0),A=o(!1),j=o(!1),M=o(!1),N=o({"/3d/glb/main-d.glb":{total:0,loaded:0,show:!0},"/3d/glb/树.glb":{total:0,loaded:0,show:!0},"/3d/glb/配楼.glb":{total:0,loaded:0,show:!0},"/3d/glb/cameras.glb":{total:0,loaded:0,show:!0},"/3d/glb/water.glb":{total:0,loaded:0,show:!0},"/3d/glb/b1-d.glb":{total:0,loaded:0,pos:[11,0,-3],rot:[0,Math.PI/1.98,0],show:!1},"/3d/glb/世纪仓库-d.glb":{total:0,loaded:0,pos:[-9,0,-12],rot:[0,Math.PI/1.95,0],show:!1},"/3d/glb/edge.glb":{total:0,loaded:0,show:!0},"/3d/glb/货物.glb":{total:0,loaded:0,pos:[-9,0,-12],rot:[0,Math.PI/1.95,0],show:!1}}),P={x:0,y:45,z:0},F={environmentIntensity:.38,ambient:{color:15397375,intensity:.05},hemisphere:{skyColor:12375807,groundColor:13350298,intensity:.14},directional:{color:16764830,intensity:.5,outdoorIntensity:11.8,position:{x:100,y:85,z:0},target:{x:-9,y:0,z:-12}},indoor:{environmentIntensity:.5,ambient:{color:15397375,intensity:.14},hemisphere:{skyColor:12375807,groundColor:13350298,intensity:.36}}},I=[{name:`B1栋`,typeName:[`/3d/glb/b1-d.glb`],size:[8.2,2.4,4],rot:[0,.02,0],pos:[11.1,1.2,-3.8]},{name:`世纪物流园`,typeName:[`/3d/glb/世纪仓库-d.glb`,`/3d/glb/货物.glb`],size:[8.2,2.8,4],rot:[0,Math.PI/1.95,0],pos:[-9.2,1.4,-11.8],storageRot:[0,0,0]},{name:`闸口`,size:[4.2,1,2],rot:[0,.02,0],pos:[4.2,.5,-14.8]}];i(N.value,e=>{let t=0,n=0,r=Object.keys(e).length;for(let r in e)t+=e[r].total||0,n+=e[r].loaded||0;let i;i=t>0?n/t*100:r>0?k.value/r*100:0,h.value=Math.min(100,Math.max(0,Math.round(i)))});let L=d(()=>h.value<100||k.value!==Object.keys(N.value).length);i(L,e=>{e||(h.value=100,V(),U(),H(x),z())});let R=e=>{let t=new _.Box3,n=new _.Vector3;e.traverse(e=>{e.isMesh&&(e.receiveShadow=!0,t.setFromObject(e),t.getSize(n),e.castShadow=n.y>.35)})},z=()=>{if(!g||!g.dirLight||!x)return;x.updateMatrixWorld(!0);let e=new _.Box3,t=new _.Box3,n=new _.Vector3;if(x.traverse(r=>{r.isMesh&&(t.setFromObject(r),t.isEmpty()||(t.getSize(n),Math.max(n.x,n.y,n.z)>200||e.union(t)))}),e.isEmpty())return;let r=e.getCenter(new _.Vector3),i=e.getSize(new _.Vector3),a=_.MathUtils.clamp(Math.max(i.x,i.z)*.62+4,12,80),o=g.dirLight,s=new _.Vector3().subVectors(o.target.position,o.position).normalize(),c=o.position.distanceTo(o.target.position);o.target.position.copy(r),o.target.updateMatrixWorld(),o.position.copy(r).addScaledVector(s,-c);let l=o.shadow.camera;l.left=-a,l.right=a,l.top=a,l.bottom=-a,l.near=Math.max(c-a*2,.1),l.far=c+a*2,l.updateProjectionMatrix(),o.shadow.mapSize.set(2048,2048),o.shadow.needsUpdate=!0,g.renderer.shadowMap.needsUpdate=!0},B=async e=>{g.camera.position.set(P.x,P.y+15,P.z),g.glbModelLoader(e,t=>{let n=t.scene;if(n.name=e,N.value[e].show)x.add(n),x.updateMatrixWorld(!0),R(n);else{C.add(n),n.visible=!1,n.on(`dblclick`,(e,t,n)=>{console.log(`双击模型:`,t,n),g.setOutlineObjects(t)});let e=[];n.traverse(t=>{t.isMesh&&(t.name.indexOf(`SM_摄像头`)!==-1&&(t.material.emissiveIntensity=1,t.material.metalness=.1,t.material.roughness=.8),t.name.indexOf(`墙_2`)!==-1&&(t.material.metalness=.1,t.material.roughness=.8),t.name.indexOf(`停车`)!==-1&&(t.material.emissiveIntensity=20),t.name.indexOf(`Plane`)!==-1&&(t.material=new _.MeshBasicMaterial({color:t.material.color,map:t.material.map})),t.name.indexOf(`B1_地面`)!==-1&&(t.material.metalness=.1,t.material.roughness=.8),(t.name.indexOf(`地面反射`)!==-1||t.name.indexOf(`B1_地面`)!==-1)&&e.push(t))}),g.addFloorReflections(e)}N.value[e].pos&&(n.position.set(...N.value[e].pos),n.scale.set(.05,.05,.05)),N.value[e].rot&&n.rotation.set(...N.value[e].rot),k.value++},t=>{N.value[e].total=t.total,N.value[e].loaded=t.loaded})},V=async()=>{await g.thingAnimate(g.camera.position,P,1200)},H=e=>{e.on(`dblclick`,(e,t,n)=>{console.log(`双击模型:`,t,n),g.setOutlineObjects(t)});let t=[`b1_diji004_3`,`3d66-PolyMeshObject-20022528-001`,`对象005_4`,`对象005_3`,`对象005_2`,`Line001`,`Line002`,`1号楼`,`SM_DiMian_1`,`3d66-PolyMeshObject-20022528-006`];e.traverse(e=>{if(e.isMesh&&(e.castShadow=!0,e.receiveShadow=!0),e.isLight&&(e.intensity=0),e.isMesh&&e.name===`Water_Plane`){let t=e.position.clone();t.y=-20;let n=new _.Box3().setFromObject(e),r=new _.Vector3;n.getSize(r);let i=r.x/.05,a=r.z/.05,o=new _.PlaneGeometry(i,a,64,64);o.computeVertexNormals();let s=new D(o,{textureWidth:512,textureHeight:512,waterNormals:new _.TextureLoader().load(`/3d/textures/waternormals.png`,e=>{e.wrapS=e.wrapT=_.RepeatWrapping}),sunDirection:new _.Vector3(1,1,1),sunColor:16777215,waterColor:16448,distortionScale:1,alpha:1});s.position.copy(t),s.rotateX(-Math.PI/2),e.parent.add(s),e.parent.remove(e),v=s}e.isMesh&&t.includes(e.name)&&(e.receiveShadow=!0),e.isMesh&&e.name===`3d66-PolyMeshObject-20022528-006`&&(e.position.y=2.5),e.isMesh&&e.name===`Plane_(1)`&&(e.visible=!1),e.isMesh&&e.name===`边缘`&&(y=e,e.material.alphaMap=e.material.map,e.material.alphaTest=.05),e.isMesh&&[`T2_1_2`,`T4_1_2`].includes(e.name)&&e.material.color.set(24576),e.isMesh&&[`Line001`,`Line002`,`1号楼`].includes(e.name)&&e.material.color.set(6710886)})},U=()=>{let e=new _.Group;b=new _.MeshBasicMaterial({color:4316572,transparent:!0,opacity:.15}),I.forEach(t=>{let n=new _.Mesh(new _.BoxGeometry(...t.size),b);if(n.position.set(...t.pos),n.rotation.set(...t.rot),n.userData=t,n.name=t.name,t.name){let e=g.createText({element:t.name,className:`building-name`,color:`#fff`,position:{x:t.pos[0],y:t.size[1]+2,z:t.pos[2]}});S.add(e)}if(t.subName){let e=g.createText({element:t.subName,className:`building-name-3d`,color:`rgba(255, 255, 255, 0.45)`,type:`3d`,position:{x:t.pos[0],y:t.size[1],z:t.pos[2]}});e.rotateX(-Math.PI/2),e.scale.set(.06,.06,.06),S.add(e)}e.add(n)}),e.name=`building-box`,e.on(`hover`,(e,t)=>{document.body.style.cursor=`pointer`,g.setOutlineObjects(t)},()=>{document.body.style.cursor=`default`,g.clearOutline()}),e.on(`click`,(e,t)=>{G(t)}),S.add(e)},W=e=>{g&&g.renderer&&(g.renderer.shadowMap.enabled=e,g.dirLight&&(g.dirLight.castShadow=e),g.renderer.shadowMap.needsUpdate=e)},G=async e=>{if(j.value||!e.userData.typeName)return;j.value=!0,T=e,e.userData.typeName.forEach(e=>{C.getObjectByName(e).visible=!0});let t=new _.Vector3(e.position.x,e.position.y+20,e.position.z),n=new _.Vector3(e.position.x,e.position.y+5,e.position.z),r={x:e.position.x,y:e.position.y-1,z:e.position.z};Promise.all([g.thingAnimate(g.camera.position,[t,n],800),g.thingAnimate(g.controls.target,r,800)]),S.traverse(e=>{e.isCSS2DObject&&(e.element.style.opacity=0)}),setTimeout(()=>{w.near=.001,g.switchScene({scene:C,camera:w,transition:{type:4,duration:1},onComplete:()=>{W(!1),S.traverse(e=>{e.isMesh&&(e.visible=!1)}),A.value=!0,j.value=!1,e.userData.storageRot&&e.userData.typeName.forEach(t=>{let n=C.getObjectByName(t),r=e.userData.storageRot;g.thingAnimate(n.rotation,[{x:r[0],y:r[1],z:r[2]}],500)})}})},800)},K=async()=>{if(j.value)return;j.value=!0,W(!0),S.traverse(e=>{e.isMesh&&(e.visible=!0)}),g.camera.near=1,g.switchScene({scene:S,camera:g.camera,transition:{type:5,duration:1},onComplete:()=>{A.value=!1,j.value=!1,T.userData.typeName.forEach(e=>{C.getObjectByName(e).visible=!1}),S.traverse(e=>{e.isCSS2DObject&&(e.element.style.opacity=1)})}}),T.userData.storageRot&&T.userData.typeName.forEach(e=>{let t=C.getObjectByName(e),n=T.userData.storageRot;g.thingAnimate(t.rotation,[{x:n[0],y:Math.PI/2,z:n[2]}],500)});let e=T.userData.pos;await g.thingAnimate(g.camera.position,[new _.Vector3(e[0],e[1]+15,e[2])],800),Promise.all([g.thingAnimate(g.camera.position,new _.Vector3(0,50,1),1e3),g.thingAnimate(g.controls.target,new _.Vector3(0,0,0),1e3)])},q=()=>{C=new _.Scene,C.name=`innerScene`,w=g.camera,C.environment=g.scene.environment,C.environmentIntensity=F.indoor.environmentIntensity,g.environmentCallback=e=>{C&&(C.environment=e,C.environmentIntensity=F.indoor.environmentIntensity)};let e=new _.AmbientLight(F.indoor.ambient.color,F.indoor.ambient.intensity);C.add(e);let t=new _.HemisphereLight(F.indoor.hemisphere.skyColor,F.indoor.hemisphere.groundColor,F.indoor.hemisphere.intensity);C.add(t);let n=new _.DirectionalLight(F.directional.color,F.directional.intensity);n.position.set(F.directional.position.x,F.directional.position.y,F.directional.position.z),n.target.position.set(F.directional.target.x,F.directional.target.y,F.directional.target.z),C.add(n),C.add(n.target)},J=()=>{if(v&&(v.material.uniforms.time.value=performance.now()*5e-4),y&&y.visible){let e=y.material;e.map.offset.x+=.01}if(g&&g.camera&&g.dirLight&&!A.value){let e=g.camera.position.y,t=F.directional.outdoorIntensity,n=F.directional.outdoorIntensity*.55,r=t;if(e>=70)r=n,g.bloomPass&&(g.bloomPass.enabled=!0),b&&(b.opacity=.15),M.value=!0;else if(e>40){let i=(e-40)/30;y&&(y.visible=!0),r=_.MathUtils.lerp(t,n,i),g.bloomPass&&(g.bloomPass.enabled=!0),b&&(b.opacity=.15),M.value=!0}else y&&(y.visible=!1),g.bloomPass&&(g.bloomPass.enabled=!1),b&&(b.opacity=0),M.value=!1;g.dirLight.intensity=r}A.value&&g.bloomPass&&(g.bloomPass.enabled=!0)};return n(()=>{g=new m(p.value,{mode:``,environmentIntensity:F.environmentIntensity,ambLight:{color:F.ambient.color,intensity:F.ambient.intensity},hemiLight:{skyColor:F.hemisphere.skyColor,groundColor:F.hemisphere.groundColor,intensity:F.hemisphere.intensity},dirLight:{color:F.directional.color,intensity:F.directional.outdoorIntensity,position:F.directional.position,target:F.directional.target,castShadow:!0},fog:{enabled:!0,type:`FogExp2`,color:13228262,density:.0022,near:60,far:420},quality:{envMapIntensity:.75},postProcessing:{gtao:{radius:1.2,blendIntensity:1.25},bloom:{strength:.1},vignette:{darkness:.22},output:{toneMappingExposure:1.02}}}),_=g.THREE,S=g.scene,q(),x=new _.Group,x.scale.set(.05,.05,.05),x.rotation.y=Math.PI*1.1,x.position.set(95,0,-3),S.add(x),Object.keys(N.value).forEach(e=>{B(e)}),g.animateCallback=J,g.start()}),setTimeout(()=>{L.value&&(h.value=100,k.value=Object.keys(N.value).length)},3e4),e(()=>{g.clear(),C&&(C.traverse(e=>{e.isMesh&&(e.geometry&&e.geometry.dispose(),e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.dispose()):e.material.dispose()))}),C.clear()),w=null,x=null}),(e,n)=>(t(),c(`div`,O,[s(`div`,{ref_key:`container`,ref:p,class:`sence-canvas-wrap`},null,512),f(E,{visible:L.value,progress:h.value,brand:`THREE SCENE`,title:`场景资源载入`,status:`正在加载模型与贴图 · 场景预编译中`,accent:`#39d8ff`,accent2:`#7ce8c8`},null,8,[`visible`,`progress`]),s(`div`,{class:r([{show:a(M)},`container-mask`])},null,2),a(A)&&!a(j)?(t(),c(`button`,{key:0,class:`back-btn`,onClick:K},` 返回 `)):l(``,!0)]))}},[[`__scopeId`,`data-v-36378f3f`]]);export{k as default};