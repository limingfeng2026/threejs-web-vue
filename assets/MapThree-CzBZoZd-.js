import{F as e,L as t,P as n,Vt as r,Wt as i,_ as a,a as o,ct as s,d as c,et as l,m as u,p as d,t as f,v as p,z as m}from"./_plugin-vue_export-helper-BO1WDfay.js";import{Bo as ee,Fr as te,R as ne,Rr as h,Un as re,Vn as g,Vt as ie,X as _,Zi as v,aa as ae,ca as y,da as oe,en as b,fa as se,fr as x,ht as ce,lo as S,mt as le,pr as ue,q as de,qa as fe,ua as pe,uo as C,xr as me,yr as he,za as ge}from"./index-BcbeG1I3.js";import{n as w,t as _e}from"./SceneView-DRBZBOju.js";import{t as ve}from"./SceneLoading-CYid77Xn.js";var ye=class extends y{constructor(e={}){let t={color:new _(3807304),fresnelColor:new _(16711901),fresnelPower:.3,fresnelScale:.85,fresnelBias:.1,doubleSide:!1,map:null,mapIntensity:.6,...e},n={color:{value:new _(t.color)},fresnelColor:{value:new _(t.fresnelColor)},fresnelPower:{value:t.fresnelPower},fresnelScale:{value:t.fresnelScale},fresnelBias:{value:t.fresnelBias},map:{value:t.map},mapIntensity:{value:t.mapIntensity},hasMap:{value:!!t.map}};super({uniforms:n,vertexShader:`
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
            `,fragmentShader:`
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
            `,side:t.doubleSide?2:0}),this.config=t,this.uniforms=n,this.isFresnelMaterial=!0,this.color=new _(t.color),this.fresnelColor=new _(t.fresnelColor),this.fresnelPower=t.fresnelPower,this.fresnelScale=t.fresnelScale,this.fresnelBias=t.fresnelBias}setFresnelColor(e,t,n){typeof e==`number`||typeof e==`string`?this.uniforms.fresnelColor.value.set(e):e instanceof _&&this.uniforms.fresnelColor.value.copy(e),this.needsUpdate=!0}setColor(e){typeof e==`number`||typeof e==`string`?this.uniforms.color.value.set(e):e instanceof _&&this.uniforms.color.value.copy(e),this.needsUpdate=!0}adjustFresnel(e){e.power!==void 0&&(this.uniforms.fresnelPower.value=e.power),e.scale!==void 0&&(this.uniforms.fresnelScale.value=e.scale),e.bias!==void 0&&(this.uniforms.fresnelBias.value=e.bias),this.needsUpdate=!0}setMap(e,t=.6){e&&(e.wrapS=v,e.wrapT=v,e.needsUpdate=!0),this.uniforms.map.value=e,this.uniforms.hasMap.value=!!e,this.uniforms.mapIntensity.value=Math.max(0,Math.min(1,t)),this.needsUpdate=!0}},be={async getAllFactories(e=!1){let t={data:[{code:`WZP`,name:`五指耙水厂`,businessCode:`BAWZP`,tenantId:`fe5fda15-3f1a-875b-bb1b-3a087431669c`,threeDimensionalUrl:`/dt/#/digitaltwin?code=WZP&dev=true&mock=false&cloudurl=http://172.17.128.43:8889&orderID=48e02BF5`,bizType:1,sort:null,extraProperties:{isTrashSource:!0,mapSubTitle:``,mapCoord:`113.879786,22.758244`,mapPolygonCoords:``,mapArea:`宝安区`,externalOrgCode:``,flowChartConfig:`{"data":[
  {"id":"32837965-ed32-44d2-b949-0445712361d9","title":"工艺流程图"},
  {"id":"7cf88806-b8f2-4135-b9af-d3ab28e300bc","title":"送水泵房"},
  {"id":"lvchi","title":"V型滤池","children":
    [{"id":"f1a2a00f-5500-483f-b482-de631de21ad7","title":"#1#2V型滤池"},
      {"id":"fdd6258b-f4f4-4704-9d8a-2ed88b61b617","title":"#3#4V型滤池"}]
  },
  {"id":"hunhejing","title":"混合井","children":
    [{"id":"6b9a015a-0386-4c35-818a-c2b11986f820","title":"#1#2混合井反应沉淀池"},
    {"id":"51ac2541-f68c-4c7b-abfb-0bb2e418edf4","title":"#3#4混合井反应池沉淀池"}
    ] 
  },
  {"id":"huishoushuichi","title":"回收水池","children":
    [{"id":"9e14ae8e-08a0-496f-93bc-440142e19e6d","title":"1#回收水池"},
    {"id":"2efd25c7-9b27-4171-b444-120727695543","title":"2#回收水池"}
    ] 
  },
  {"id":"jiayaojian","title":"加药间","children":
    [{"id":"4e23b6f3-85bb-4b3e-b462-2aea78043594","title":"碱铝投加"},
    {"id":"2d827ab2-42fd-48a1-a3c8-4a9e27d577e4","title":"臭氧投加"},
    {"id":"3f809a5c-8a77-49c3-928e-6362c67dff0f","title":"盐酸投加"},
      {"id":"d9e944b9-6f31-4872-a989-82ef763f5058","title":"高锰酸钾投加"},
    {"id":"32753413-2c53-4ce2-a75a-da97a6cde57b","title":"次氯酸钠投加"}
    ]
  },
  {"id":"d591d7d6-edce-4740-8c27-35f6f1fd1c89","title":"提升泵房"},
  {"id":"1ba5eed8-5e89-4cce-b55f-cae826ad5b20","title":"配水井"},
  {"id":"ab7ef87c-68f2-444a-9401-4e20e78a99c3","title":"脱水车间"},
  {"id":"61403ab3-91b2-4707-a306-719a8fc27b38","title":"活性炭滤池"}
  ]
}`,threeConfig:``},id:1301},{code:`ZA`,name:`朱坳水厂`,businessCode:`BAZA`,tenantId:`fe5fda15-3f1a-875b-bb1b-3a087431669c`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!0,mapSubTitle:``,mapCoord:`113.876942,22.603405`,mapPolygonCoords:``,mapArea:`宝安区`,externalOrgCode:``},id:1302},{code:`XA`,name:`新安水厂`,businessCode:`BAXA`,tenantId:`fe5fda15-3f1a-875b-bb1b-3a087431669c`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!0,mapSubTitle:``,mapCoord:`113.894767,22.580677`,mapPolygonCoords:``,mapArea:`宝安区`,externalOrgCode:``},id:1303},{code:`FH`,name:`凤凰水厂`,businessCode:`BAHF`,tenantId:`fe5fda15-3f1a-875b-bb1b-3a087431669c`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!0,mapSubTitle:null,mapCoord:null,mapPolygonCoords:null,mapArea:null,externalOrgCode:null},id:1304},{code:`CLP`,name:`长流陂水厂`,businessCode:`BACLP`,tenantId:`fe5fda15-3f1a-875b-bb1b-3a087431669c`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!0,mapSubTitle:``,mapCoord:`113.874682,22.730563`,mapPolygonCoords:``,mapArea:`宝安区`,externalOrgCode:``},id:1305},{code:`SYH`,name:`石岩湖水厂`,businessCode:`BASYH`,tenantId:`fe5fda15-3f1a-875b-bb1b-3a087431669c`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!0,mapSubTitle:``,mapCoord:`113.920865,22.707199`,mapPolygonCoords:``,mapArea:`宝安区`,externalOrgCode:``,threeConfig:``},id:1306},{code:`BJS`,name:`笔架山水厂`,businessCode:`FTBJS`,tenantId:`80a43d7f-0aa8-0f38-974a-39fe6e4c32fb`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!1,mapSubTitle:`BIJIASHANSHUICHANG`,mapCoord:`114.074478,22.565829`,mapPolygonCoords:`114.074478,22.565829;114.031906,22.681182;113.943328,22.681182`,mapArea:`福田区`,flowChartConfig:`{"data":[
  {"id":"7bb20374-2c6f-47cf-9f3f-8bac93b0856f","title":"工艺总图"},
  {"id":"f3cc6c83-948d-4c29-a381-800431c83673","title":"水厂参数"},
  {
    "title":"反应沉淀池",
    "id":"menul1",
    "children":[
  {"id":"fb6051fa-d5e9-4d8e-86e2-bccaa4b85859","title":"老厂反应沉淀池"},
  {"id":"adcd6d64-530a-4dcb-bb9d-9885688af08c","title":"新厂反应沉淀池"},
  {"id":"6e19a30b-6bf0-4faa-bca1-5b5e569b93a3","title":"预处理车间"}
      ]
  },
  {
    "title":"滤池",
    "id":"menul2",
    "children":[
  {"id":"150760b9-4cdb-4e9a-90eb-236b393eb0d4","title":"老厂V型滤池"},
  {"id":"a845a2e1-122b-4882-9041-3a61d3a2a851","title":"新厂V型滤池"},
  {"id":"60b13123-5a26-4613-9f05-f7c0221f049a","title":"普通快滤池"}
      ]
  },
  {
    "title":"清水池",
    "id":"menul3",
    "children":[
  {"id":"4c71485f-070b-4c67-a485-4f83fa17454c","title":"3#清水池"},
  {"id":"0d844d7e-1b2e-4130-b92e-7a758b65c3d5","title":"2#清水池"}
      ]
  },
  {
    "title":"送水泵房",
    "id":"menul4",
    "children":[
  {"id":"e58295ec-7c50-4082-91ff-1930bd1830a9","title":"老厂送水泵房"},
  {"id":"39f7e90d-5f84-4aff-bb77-9f3bab0a1e2b","title":"新厂送水泵房"}
      ]
  },
  {
    "title":"加药系统",
    "id":"menul5",
    "children":[
  {"id":"7661dd65-41e4-49de-b1fb-0667d3e8f6ee","title":"老厂石灰间"},
  {"id":"6f0558a3-664f-4f1c-8c25-569b51a6d3bc","title":"新厂石灰间"},
  {"id":"10d2ed7b-e3be-4b90-a13c-338a1fe01712","title":"石灰澄清系统"},
  {"id":"6c987fde-606e-4cc2-ae40-2501300af229","title":"碱铝投加间"},
  {"id":"50bdd21b-e986-4211-8cee-6b53ec849887","title":"次氯酸钠车间"}
      ]
  },
  {
    "title":"反冲洗系统",
    "id":"menul6",
    "children":[
  {"id":"2c87ab81-14eb-4e43-b350-0ecb8409cbc8","title":"反冲洗泵房"},
  {"id":"6243829a-556c-440f-9cf1-e394e9bf9218","title":"鼓风机房"}
      ]
  },
  {
    "title":"臭氧-生物活性炭滤池",
    "id":"menul7",
    "children":[
  {"id":"0f4e99ee-7608-4c83-b157-81316b4efc25","title":"液氧站"},
  {"id":"5077486c-3d37-4708-b24a-99cd4481a967","title":"臭氧间"},
  {"id":"38259fc9-b82c-4bc5-ba7c-8f01650d1cbc","title":"活性炭滤池"}
      ]
  },
  {"id":"671e3f6c-5b2c-4e44-a517-5dbd8d3e64f6","title":"回流水池"},
  {
    "title":"污泥脱水系统",
    "id":"menul8",
    "children":[
  {"id":"34ac31c5-dd07-4be2-9c59-197514d38ed8","title":"均衡池"},
  {"id":"40f9b79f-b8d3-469e-9598-82bfb13ebf27","title":"污泥提升泵房"},
  {"id":"7babde23-c9ae-4e1c-a1d1-5431e4626390","title":"浓缩池"},
  {"id":"bf880c29-af86-409a-a024-0bca4369baca","title":"脱水车间"}
      ]
  }]}`,externalOrgCode:`s46`},id:1},{code:`YTS`,name:`盐田水质净化厂`,businessCode:`YTYTS`,tenantId:`32e955ca-37f0-cb39-bbf7-39f9dd66dc9d`,threeDimensionalUrl:null,bizType:2,sort:1,extraProperties:{isTrashSource:!1,mapSubTitle:`YANTIANSHUIZHIJINGHUACHANG`,mapCoord:`114.256668,22.570628`,mapPolygonCoords:`114.256668,22.570628;114.36630249023438,22.684984142872107;114.51736450195312,22.684984142872107`,mapArea:`盐田区`,flowChartConfig:`{"data":[{"id":"5bb3e014-d2ab-4e40-a719-f7a94d124a64","title":"工艺流程"},{"id":"ee70e301-5283-4dd3-ad04-aec245af892a","title":"粗格栅"},{"id":"ea2e8945-913f-41fa-b05d-5d8988f41626","title":"细格栅"},{"id":"a2057dcd-1100-41b4-81cc-bb4cbc150f87","title":"鼓风机房"},{"id":"shengwuchi","title":"生物池","children":[{"id":"c152e0e3-9ae8-4402-bfab-0b0c9786176d","title":"1#生物池"},{"id":"a5c64eb2-2df6-4162-b7b3-5334f5160fa1","title":"2#生物池"},{"id":"91106d6b-5626-4ad4-aa4a-fa90d27654dd","title":"3#生物池"}]},{"id":"977a4107-ac39-4d08-a592-a649ec740455","title":"二沉池"},{"id":"79d76227-695e-4700-a37b-e30062ade8d6","title":"高效沉淀池"},{"id":"6f47b949-aa61-4acd-9783-48df8bdfb789","title":"次氯酸钠"},{"id":"6fb1739e-5aaf-491c-bf5e-097f61db407d","title":"加药间"},{"id":"6a2aff72-e802-4069-858d-ccdb75f87751","title":"紫外消毒"},{"id":"19d16acf-aff3-4dfc-85b0-e397e9842eda","title":"中水系统"},{"id":"a3cc9723-b19d-45be-8e99-b23ca689b432","title":"污泥车间"},{"id":"1f916fce-2e13-41fd-b96d-4ab4b83f9de7","title":"排水泵站系统"}]}`,externalOrgCode:`b3363`},id:2},{code:`ML`,name:`梅林水厂`,businessCode:`FTML`,tenantId:`80a43d7f-0aa8-0f38-974a-39fe6e4c32fb`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!1,mapSubTitle:`MEILINSHUICHANG`,mapCoord:`114.030746,22.559527`,mapPolygonCoords:`114.030746,22.559527;114.10812377929688,22.653304181183618;114.21798706054688,22.653304181183618`,mapArea:`福田区`,flowChartConfig:`{
  "data": [
    {
      "id": "18cce3b6-7b22-4daa-aed8-83ea45079f43",
      "title": "工艺总图"
    },
    {
    "title":"沉淀池",
    "id":"menul1",
    "children":[
  {"id":"e16adb14-4140-4d48-8ae6-f9f3a59a688b","title":"沉淀池一期"},
  {"id":"f0fcfe4a-eb8f-47c4-8db1-e3fff96810c2","title":"沉淀池二期"},
  {"id":"6e31bd7b-ddfc-4670-acb3-046ae230cfcc","title": "回收水沉淀池"}
      ]
  },
  {
    "title":"加药间",
    "id":"menul2",
    "children":[
  {"id":"c1f6daeb-7c18-4a56-9754-bba7c5ecd83f","title":"次氯酸钠"},
  {"id":"5eaac19a-133a-4fe1-bda0-20f2ea1b4adb","title":"氢氧化钠"},
  {"id":"d3528623-8f9d-4fa1-a3e1-a16cd6c253da","title": "PAC投加"}
      ]
  },
  {
    "title":"滤池",
    "id":"menul3",
    "children":[
  {"id":"9cbfb2a4-0df6-4d7a-bc42-562962288936","title":"砂滤池"},
  {"id":"a18d22f2-17b5-4770-8a29-7c54aa297012","title":"砂滤池反冲泵房"},
  {"id":"3101b207-3660-4de1-b39d-eb1177c5b563","title":"碳滤池"}
      ]
  },
  {
    "title":"臭氧",
    "id":"menul4",
    "children":[
  {"id": "e02d0af4-5a68-4726-9cc8-646ab389495a","title": "臭氧发生间"},
  {"id": "b01a49e0-052f-4a71-9ca9-40b258e6b19e","title": "主臭氧池"}
      ]
  },
    
    {
      "id": "b4aff1df-e7db-4e43-8f41-1726534200a9",
      "title": "回收水泵井"
    },
    {
      "id": "5d67282c-936d-490a-a8bc-451a22e54fce",
      "title": "配水井"
    },
    {
      "id": "668d04df-5820-4b6e-959f-1bd03ea71839",
      "title": "清水池"
    },
    {
      "id": "d3df7481-492b-4336-936b-766ea05a881f",
      "title": "石灰间"
    },
    {
      "id": "fbe288c6-4586-40ad-842d-120f43fd3f50",
      "title": "送水泵房"
    },
    {
      "id": "79a36097-8078-418d-9ec1-272671bae4bf",
      "title": "提升泵房"
    },
    {
      "id": "06f53fd9-1139-4fff-a596-70667a36773d",
      "title": "格栅间"
    }
  ]
}`,externalOrgCode:`s48`},id:3},{code:`LF`,name:`罗芳水质净化厂`,businessCode:`LHLF`,tenantId:`10345868-194a-a2f6-2830-39f40ea2f376`,threeDimensionalUrl:null,bizType:2,sort:2,extraProperties:{isTrashSource:!1,mapSubTitle:`LUOFANGSHUIZHIJINGHUACHANG`,mapCoord:`114.155173,22.547402`,mapPolygonCoords:`114.155173,22.547402;114.25643920898438,22.701454830506705;114.38278198242188,22.701454830506705`,mapArea:`罗湖区`,flowChartConfig:`{"data":[{"id":"27e3478a-26eb-4c6a-8307-70bc698425a1","title":"工艺总图"},
{
      "title": "粗格栅",
      "id":"menu1",
      "children":[
          {"id":"015268db-6348-4c49-a1d5-8b7ab0c03078","title":"东粗格栅"},
          {"id":"6ea319e4-87cf-47c4-b32c-b2c3b4f612d9","title":"西粗格栅"}
      ]
    },
    {"id":"ed75794d-69e0-4459-b136-f435589db814","title":"细格栅"},
{"id":"dccbd8e5-89d7-4022-9530-05e1ef0bccd0","title":"速沉池"},
{"id":"06df4a4c-9392-4cd0-a87c-e17aa711530a","title":"精细格栅"},
{
      "title": "生化池",
      "id":"menu2",
      "children":[
         {"id":"34d2d15c-54ee-46ef-8843-d20810b33bf6","title":"1#生化池"},
          {"id":"ef45ad3f-c63a-47a4-b17b-d5a60e1448ab","title":"2#生化池"},
          {"id":"ed0c396f-4acd-4ab0-bd4a-a5045723f53c","title":"3#生化池"},
          {"id":"f75d3b71-31eb-41af-84e8-8be152807562","title":"4#生化池"},
          {"id":"ffeec397-ab06-4ee7-b1f6-cd0a69ae87bf","title":"生化池鼓风机"}
      ]
    },
{
      "title": "膜池",
      "id":"menu3",
      "children":[
         {"id":"03bc68de-06f2-46ab-abfa-d61de0006062","title":"1组膜池"},
         {"id":"7b4ef0cf-4d3e-49c4-9865-eb4c7896595d","title":"2组膜池"},
         {"id":"d48f5c93-5e8b-4168-89f2-b17b8f6c934c","title":"3组膜池"},
         {"id":"5ab3988d-a132-4a91-aee3-5235ebf4533c","title":"4组膜池"},
         {"id":"941619f6-ed42-4853-bac6-d4e933156017","title":"膜池鼓风机"}
      ]
    },
{
      "title": "加药间",
      "id":"menu4",
      "children":[
        {"id":"9390f0a7-52a2-4a4e-a1e8-b393dde2e431","title":"PAC加药间"},
        {"id":"d1186bd3-10e6-4b97-87cc-243ede035b0f","title":"次氯酸钠加药间"},
        {"id":"62cc8416-ab6c-49b0-a786-835e82030baa","title":"乙酸钠加药间"}
      ]
    },
{"id":"8865b959-9d0b-4638-bd45-45685f8c3731","title":"紫外消毒"},
{
      "title": "除臭",
      "id":"menu5",
      "children":[
        {"id":"8fb80ee0-e26f-4615-8346-0933f7bab020","title":"物理段除臭"},
        {"id":"085f0155-ef25-4d48-98ad-8ce33c248da8","title":"1#生化池除臭"},
        {"id":"10633c8f-9017-41d4-abfb-052f70b0c58a","title":"2#生化池除臭"},
        {"id":"0070c6ab-1f10-4a3f-b347-ee0e940de749","title":"3#生化池除臭"},
        {"id":"40539f18-21d5-4fc7-8476-13b044768ae6","title":"4#生化池除臭"},
        {"id":"e29aa34c-90d7-41c4-8704-a2300d47959b","title":"西区除臭"}
      ]
    },
{"id":"7958b487-4eab-49b7-b011-e95a9aa77e9d","title":"中水泵房"},
{
      "title": "污泥车间",
      "id":"menu6",
      "children":[
        {"id":"92dc1525-4876-4085-a5db-45f95ce1d48a","title":"污泥车间F1"},
        {"id":"b0fafef1-cd22-4fe8-a6f1-28e465419f9b","title":"污泥车间F234"}
      ]
    }
]}`,externalOrgCode:`s202`},id:4},{code:`DH`,name:`东湖水厂`,businessCode:`LHDH`,tenantId:`10345868-194a-a2f6-2830-39f40ea2f376`,threeDimensionalUrl:null,bizType:1,sort:null,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:``,mapPolygonCoords:``,mapArea:``,threeConfig:``,externalOrgCode:`s47`},id:5},{code:`BHSZ`,name:`滨河水质净化厂`,businessCode:`BHSZ`,tenantId:`80a43d7f-0aa8-0f38-974a-39fe6e4c32fb`,threeDimensionalUrl:null,bizType:2,sort:null,extraProperties:{isTrashSource:!0,mapSubTitle:``,mapCoord:``,mapPolygonCoords:``,mapArea:``,externalOrgCode:`s52`},id:6},{code:`NSDCAdmin`,name:`大涌水厂`,businessCode:`NSDCAdmin`,tenantId:`86cfd7c1-72f9-36da-6fe8-39fdaa8250cb`,threeDimensionalUrl:null,bizType:1,sort:3,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:``,mapPolygonCoords:``,mapArea:``,flowChartConfig:`{"data":[
  {"id":"6fc582a9-ce96-45af-9882-38dcd302c065","title":"工艺总图"},
    {"id":"4da4c56f-e788-4a36-b0e8-e675e5f8e226","title":"数据在线"},
  {"id":"41cbba86-9801-4b4f-8a96-af8ccbcec34f","title":"南滤池普通快滤池"},
  {"id":"ae80eb12-691f-4900-b056-88fa81de6d08","title":"北滤池"},
  {"id":"46996769-15d1-4619-84ce-4900b9845f43","title":"沉淀池"},
  {"id":"98730eda-8733-41a3-9eaf-4ec8270aaf80","title":"次氯酸钠投加"},
  {"id":"06e7784e-3c38-47bb-9cb5-2301744169fd","title":"石灰投加系统"},
  {"id":"89c1b51b-0d4f-4b6b-89a9-874fdc34ac58","title":"回收池行车"},
  {"id":"b338982f-4c51-4b54-9fda-347e81704459","title":"加药间碱铝投加"},
  {"id":"6685a163-6365-4832-b62a-b87c067afaf9","title":"南滤池总画面"},
  {"id":"53b56d9c-0929-4c1b-a429-3a3d46fcdce6","title":"南送水泵"},
  {"id":"3a52d43a-d03d-4d3c-a4f1-b2b751f74db7","title":"北送水泵"},
  {"id":"ad2b93d3-083b-4813-9661-9d4dc5f94994","title":"南泵房高压配电图"},
  {"id":"e6723b5b-2e9d-40dd-b6c0-7ae2e9255bd3","title":"北泵房高压配电图"},
  {
    "title":"1",
    "id":"menu1",
    "children":[
      {"id":"6","title":"1"},
      {"id":"7","title":"2钠"}
      ]
  }
  
 
  
  
 
    
    
  
    
   
    
    
    
    
    
    
  
  ]}`,externalOrgCode:`s61`},id:7},{code:`NNSZ`,name:`南山水质净化厂`,businessCode:`NSSZ`,tenantId:`86cfd7c1-72f9-36da-6fe8-39fdaa8250cb`,threeDimensionalUrl:null,bizType:2,sort:1,extraProperties:{isTrashSource:!1,mapSubTitle:`NANSHANSHUIZHIJINGHUACHANG`,mapCoord:`113.907616,22.517918`,mapPolygonCoords:``,mapArea:`南山区`,externalOrgCode:`s54`},id:8},{code:`STJ`,name:`沙头角水厂`,businessCode:`YTSTJ`,tenantId:`32e955ca-37f0-cb39-bbf7-39f9dd66dc9d`,threeDimensionalUrl:null,bizType:1,sort:3,extraProperties:{isTrashSource:!1,mapSubTitle:`SHATOUJIAOSHUICHANG`,mapCoord:`114.240961,22.562319`,mapPolygonCoords:`114.240961,22.562319;114.34158325195312,22.72172372713302;114.47479248046875,22.72172372713302`,mapArea:`盐田区`,externalOrgCode:`b3349`},id:10},{code:`YTG`,name:`盐田港水厂`,businessCode:`YTYTG`,tenantId:`32e955ca-37f0-cb39-bbf7-39f9dd66dc9d`,threeDimensionalUrl:`/3d-new?f=YTG`,bizType:1,sort:2,extraProperties:{threeConfig:`{\r
  "key": "yantiangang",\r
  "factoryId": 11,\r
  "title": "水厂智慧平台",\r
  "copyright": "Copyright(C) 深圳市水务科技有限公司",\r
  "EQRunInterval": 5000,\r
  "RTDataInterval": 5000,\r
  "HACCPInterval": 5000,\r
  "YTAddMedicineView":"80.5, 3.2, -104.0,82.87247,40,36.54673,60.04623",\r
  "YTDemoCameraCode":"d20e09e88922405296b4ace9d47195a0",\r
  "YTDemoCameraName": "矾花摄像头",\r
  "YTDemoControlStopSconds": 180,\r
  "controls":{\r
    "CraftPanel":false,\r
    "SafetyPanel.AccessControlRecord":false,\r
    "ControlPanel":true\r
  },\r
  "modelInfo": {\r
    "dataUrl": "/asset3d/yantiangang/Build/Build.data",\r
    "frameworkUrl": "/asset3d/yantiangang/Build/Build.framework.js",\r
    "codeUrl": "/asset3d/yantiangang/Build/Build.wasm",\r
    "streamingAssetsUrl": {\r
       "assetbundlespath":"/asset3d/yantiangang/AssetBundles/WebGL",\r
       "defaultview":"-69.9, 3.2, -46.7,90.88891,40,57.76,95.87677",\r
       "defaultfloor":0\r
    },\r
    "companyName": "DefaultCompany",\r
    "productName": "NewHH",\r
    "productVersion": "0.1"\r
  },\r
  "defaultFloor": "0",\r
  "onlineFloorKeys": ["0"],\r
  "floors": [\r
    {\r
      "label": "地面",\r
      "value": "0",\r
      "icon": "dimian",\r
      "view": "-69.9, 3.2, -46.7,90.88891,40,57.76,95.87677"\r
    }\r
  ],\r
  "pointnames":[\r
      "鼓风机#1",\r
      "鼓风机#2",\r
      "进厂水质",\r
      "出厂水质",\r
      "精细格栅",\r
      "南砂滤池",\r
      "南沉淀池",\r
      "北砂滤池",\r
      "北沉淀池",\r
      "回收水池",\r
      "炭滤池",\r
      "污泥调节池",\r
      "反冲泵房",\r
      "送水泵#1",\r
      "送水泵#2",\r
      "送水泵#3",\r
      "送水泵#4",\r
      "提升泵#1",\r
      "提升泵#2",\r
      "提升泵#3",\r
      "臭氧发生器#1",\r
      "臭氧发生器#2"\r
  ],\r
  "toolsOptions": [\r
    {\r
      "key": "Home",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "View",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "Reset",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "RTData",\r
      "floors": [\r
        "0"\r
      ],\r
      "initValue": true\r
    },\r
    {\r
      "key": "Water",\r
      "floors": [\r
        "0"\r
      ],\r
      "initValue": true\r
    },\r
    {\r
      "key": "Ground",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "Pipeline",\r
      "floors": [\r
        "0"\r
      ],\r
      "options": [\r
        {\r
          "label": "原水管",\r
          "value": "ProcessPipes"\r
        },\r
        {\r
          "label": "药管",\r
          "value": "ChemicalPipes"\r
        },\r
        {\r
          "label": "自用水管",\r
          "value": "CleanPipes"\r
        },\r
        {\r
          "label": "雨水管",\r
          "value": "RainPipes"\r
        },\r
        {\r
          "label": "污水管",\r
          "value": "WastePipes"\r
        },\r
        {\r
          "label": "污泥管",\r
          "value": "MudPipes"\r
        }\r
      ]\r
    }\r
  ]\r
}`,isTrashSource:!1,mapSubTitle:`YANTIANGANGSHUICHANG`,mapCoord:`114.257382,22.586079`,mapPolygonCoords:`114.257382,22.586079;114.14657592773438,22.71158965395831;114.01473999023438,22.71158965395831`,mapArea:`盐田区`,externalOrgCode:`b3355`},id:11},{code:`NNSC`,name:`南山水厂`,businessCode:`NS`,tenantId:`86cfd7c1-72f9-36da-6fe8-39fdaa8250cb`,threeDimensionalUrl:null,bizType:1,sort:2,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:``,mapPolygonCoords:``,mapArea:``,externalOrgCode:`s62`},id:13},{code:`XLZS`,name:`西丽再生水厂`,businessCode:`XLZS`,tenantId:`86cfd7c1-72f9-36da-6fe8-39fdaa8250cb`,threeDimensionalUrl:null,bizType:2,sort:4,extraProperties:{isTrashSource:!1,mapSubTitle:`XILIZAISHENGSHUICHANG`,mapCoord:`113.966865,22.593197`,mapPolygonCoords:``,mapArea:`南山区`,externalOrgCode:`s56`,threeConfig:``,flowChartConfig:`{"data":[
    {"id":"2431228c-ae76-4150-868d-731436f69507","title":"工艺总图"}
  ]}`},id:16},{code:`SKSZ`,name:`蛇口水质净化厂`,businessCode:`SKSZ`,tenantId:`86cfd7c1-72f9-36da-6fe8-39fdaa8250cb`,threeDimensionalUrl:null,bizType:2,sort:5,extraProperties:{flowChartConfig:`{"data":[
  {"id":"ee0386a7-f91b-4630-b47b-00da01b6b4a1","title":"工艺流程"},
  {"id":"91d29b7f-d73a-4f71-9946-13292fe9dffb","title":"细格栅"},
  {"id":"4893a3a0-7e74-4bd8-af48-d25db9574036","title":"加药间二站"},
  {"id":"26ca03b3-94bc-48f3-85d1-65babcc8aff7","title":"脱水机房"},
  {"id":"60d37e42-54fb-4602-b5f8-85622b3491fd","title":"浓缩池"},
  {"id":"1c621a1a-8b99-4d1f-997c-3f412a28d178","title":"滤池"},
  {"id":"b8b19b7a-f31f-408b-9c18-bdb7ae17c14a","title":"加药间一站"},
  {"id":"1cd39087-a3c0-4ae9-9d4a-f9168ab4eff8","title":"加氯间"},
  {"id":"0411232a-1113-430d-a2bb-5c13a5bd8d36","title":"鼓风机房"},
  {"id":"8bd697e6-b1c0-4967-a670-2c11a217379e","title":"生化池"}


  
    
  
  ]}`,isTrashSource:!1,mapSubTitle:``,mapCoord:``,mapPolygonCoords:``,mapArea:``,externalOrgCode:`s421`},id:17},{code:`FTSZ`,name:`福田水质净化厂`,businessCode:`FTSZ`,tenantId:`80a43d7f-0aa8-0f38-974a-39fe6e4c32fb`,threeDimensionalUrl:`/3d-new?f=FTSZ`,bizType:2,sort:1,extraProperties:{isTrashSource:!1,mapSubTitle:`FUTIANSHUIZHIJINGHUACHANG`,mapCoord:`114.018971,22.53591`,mapPolygonCoords:`114.018971,22.53591;114.10812377929688,22.653304181183618;114.21798706054688,22.653304181183618`,mapArea:`福田区`,threeConfig:`{\r
  "key": "futian",\r
  "factoryId": 72,\r
  "title": "水厂智慧平台",\r
  "copyright": "Copyright(C) 深圳市水务科技有限公司",\r
  "RTDataInterval": 10000,\r
  "controls":{\r
    "CraftPanel":false,\r
    "SafetyPanel.AccessControlRecord":false\r
  },\r
  "modelInfo": {\r
    "dataUrl": "/asset3d/futian/Build/Build.data",\r
    "frameworkUrl": "/asset3d/futian/Build/Build.framework.js",\r
    "codeUrl": "/asset3d/futian/Build/Build.wasm",\r
    "streamingAssetsUrl": {\r
       "assetbundlespath":"/asset3d/futian/AssetBundles/WebGL",\r
       "defaultview":"-139.7, 1.7, -225.8,0.3006607,40,101.6533,169.7723",\r
       "defaultfloor":0\r
    },\r
    "companyName": "DefaultCompany",\r
    "productName": "NewHH",\r
    "productVersion": "0.1"\r
  },\r
  "defaultFloor": "0",\r
  "onlineFloorKeys": ["0"],\r
  "floors": [\r
    {\r
      "label": "地面",\r
      "value": "0",\r
      "icon": "dimian",\r
      "view": "-139.7, 1.7, -225.8,0.3006607,40,101.6533,169.7723"\r
    }\r
  ],\r
  "pointnames":[\r
    "鼓风机#1",\r
    "鼓风机#2",\r
    "鼓风机#3",\r
    "鼓风机#4",\r
    "鼓风机#5",\r
    "鼓风机#6",\r
    "出厂水质",\r
    "进厂水质",\r
    "精细格栅",\r
    "速沉池",\r
    "纤维转盘滤池",\r
    "初沉淀池#1",\r
    "初沉淀池#2",\r
    "初沉淀池#3",\r
    "初沉淀池#4",\r
    "回收水池",\r
    "生物池#1",\r
    "生物池#2",\r
    "生物池#3",\r
    "生物池#4",\r
    "二沉池#1",\r
    "二沉池#2",\r
    "二沉池#3",\r
    "二沉池#4",\r
    "紫外线"\r
  ],\r
  "toolsOptions": [\r
    {\r
      "key": "Home",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "View",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "Reset",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "RTData",\r
      "floors": [\r
        "0"\r
      ],\r
      "initValue": true\r
    },\r
    {\r
      "key": "Water",\r
      "floors": [\r
        "0"\r
      ],\r
      "initValue": true\r
    },\r
    {\r
      "key": "Ground",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "Roam",\r
      "floors": [\r
        "0"\r
      ]\r
    },\r
    {\r
      "key": "Pipeline",\r
      "floors": [\r
        "0"\r
      ],\r
      "options": [\r
        {\r
          "label": "原水管",\r
          "value": "ProcessPipes"\r
        },\r
        {\r
          "label": "药管",\r
          "value": "ChemicalPipes"\r
        },\r
        {\r
          "label": "中水管",\r
          "value": "CleanPipes"\r
        },\r
        {\r
          "label": "风管",\r
          "value": "AirPipes"\r
        },\r
        {\r
          "label": "污泥管",\r
          "value": "MudPipes"\r
        }\r
      ]\r
    }\r
  ]\r
}`,flowChartConfig:`{"data":[
  {"id":"c015b365-d54a-4868-b813-122593f7e36e","title":"工艺总图"},
  {"id":"8ef8fa7a-ede2-4f7e-a5f8-900b88029a58","title":"预处理"},
  {
    "title":"加药间",
    "id":"menul1",
    "children":[
      {"id":"ff96b8f6-71c7-4bd4-83a9-f3f793e5281d","title":"PAC"},
      {"id":"dcdd7957-3c57-4bc2-a374-9ab0689fb4fb","title":"次氯酸钠"}
      ]
  },
  {"id":"9edb9d78-beeb-4f39-b8d2-c0aac4802cce","title":"回收水池"},
  {"id":"7ab0c891-01b5-41b9-b38f-0d3130117b86","title":"紫外消毒"},
  {"id":"8a137b24-537f-403c-afa2-9afcd206d8f5","title":"滤池"},
  {"id":"cc36b2b6-0cef-4558-82b1-70c1901449d3","title":"鼓风机"},
  {"id":"f32c4e85-9c0c-4ece-9809-ac1c69e3c657","title":"中水泵房"},
  {"id":"02ded691-8cb0-437e-bff7-bae2616367bd","title":"提升泵站"},
  {
    "title":"生物池",
    "id":"menul2",
    "children":[
      {"id":"220b96bf-8801-4798-b4c7-61ec72553df4","title":"1#生物池"},
      {"id":"0902005c-8777-4c73-b76a-100d796eaf75","title":"2#生物池"},
      {"id":"ae69aaa6-fc1e-4734-8d31-051b2684d811","title":"3#生物池"},
      {"id":"7a2476a4-e22b-44da-9ec5-e044c73f3843","title":"4#生物池"}
      ]
  },
  {
    "title":"初沉池",
    "id":"menul3",
    "children":[
      {"id":"40e56b32-1180-4118-8f06-0160ceeab95f","title":"1#初沉池"},
      {"id":"0709cbee-13ba-4dd2-ab20-ee036534b899","title":"2#初沉池"},
      {"id":"a3491ee1-abca-4efb-8d97-3db6415ee8f2","title":"3#初沉池"},
      {"id":"5421e000-c5e8-4143-a480-aa18ffeefcc2","title":"4#初沉池"}
      ]
  },
  {
    "title":"二沉池",
    "id":"menul4",
    "children":[
      {"id":"fe35ada1-e0e1-4331-8a76-054e84263dbd","title":"1#二沉池"},
      {"id":"5391445a-95ce-4607-8a63-b4e2241bdc0e","title":"2#二沉池"},
      {"id":"ecf12254-8785-4008-a843-f249be104e8d","title":"3#二沉池"},
      {"id":"42224c69-b8b7-4236-b5e7-1f847beb4156","title":"4#二沉池"},
       {"id":"9f34b6cf-468c-448e-b07f-68e6c21aac9e","title":"程控率"}
      ]
  },
   {
    "title":"配电系统图",
    "id":"menul5",
    "children":[
      
     
       {"id":"3507e4db-2bda-421a-8b6b-b17ac9f2d1eb","title":"鼓风机房高压配电总图"},
      {"id":"15981162-34a6-4a27-923b-37656e06b4f5","title":"鼓风机房高压配电图Ⅰ段"},
      {"id":"095951bb-5c4d-40b9-9597-6eda11c7d349","title":"鼓风机房高压配电图Ⅱ段"},
    {"id":"cd486bca-886a-42f6-baef-aabf3fe5ef77","title":"鼓风机房高压电表图"},
    {"id":"b437db8b-6252-4f4d-b7e5-42031bb66d34","title":"福田泵站高压配电图"},
      {"id":"c9fbc7c6-3e75-4328-a22d-29bfd2dad8d4","title":"福田泵站高压电表图"},
      {"id":"6c1b7a69-35cb-4e5f-8a46-f31b05efbcb4","title":"鼓风机房低压配电系统图"},
      {"id":"24f1be53-0a40-4d37-bf8a-446cfd80e12f","title":"1号线低压配电系统图"},
      {"id":"871de61b-3d03-44fc-9d11-2dfbb3385d2f","title":"2号线低压配电系统图"},
      {"id":"63b76cd7-a43f-491c-ba98-2f319b371cba","title":"3号线低压配电系统图"},
       {"id":"f6e8d842-f1a0-4ce5-84db-23c176718a1b","title":"4号线低压配电系统图"},
       {"id":"7a013e17-83e6-4409-b6ee-3908c9bb507a","title":"福田泵站低压配电系统图"},
       {"id":"460f8f4b-ae28-4f61-86a9-7884bcd96714","title":"脱水车间低压配电系统图"},
       
      {"id":"f0a7943c-51d4-4882-86d8-4ca033c6734c","title":"综合楼低压配电系统图"}
      
      
      ]
  }
  
]
}`,externalOrgCode:`s55`},id:72},{code:`QC`,name:`侨城水厂`,businessCode:`YTQC`,tenantId:`32e955ca-37f0-cb39-bbf7-39f9dd66dc9d`,threeDimensionalUrl:null,bizType:1,sort:4,extraProperties:{isTrashSource:!1,mapSubTitle:`HUAQIAOCHENGSHUICHANG`,mapCoord:`114.282613,22.64041`,mapPolygonCoords:`114.282613,22.64041;114.1534423828125,22.743256140281986;114.04907226562499,22.743256140281986`,mapArea:`盐田区`,externalOrgCode:`b3361`},id:1001},{code:`HHC`,name:`洪湖水质净化厂`,businessCode:`LHHH`,tenantId:`10345868-194a-a2f6-2830-39f40ea2f376`,threeDimensionalUrl:`/3d-new?f=HHC`,bizType:2,sort:1,extraProperties:{bluetooth:`1`,led:`1`,ventilate:`1`,isTrashSource:!1,mapSubTitle:`HONGHUSHUIZHIJINGHUACHANG`,mapCoord:`114.12684,22.578662`,mapPolygonCoords:`114.12684,22.578662;114.2083740234375,22.71285645414127;114.3319702148375,22.712856454127`,mapArea:`罗湖区`,threeConfig:`{
  "key": "honghu",
  "factoryId": 2001,
  "title": "水厂智慧平台",
  "copyright": "Copyright(C) 深圳市水务科技有限公司",
  "modelInfo": {
    "dataUrl": "/asset3d/honghu/Build/Build.data",
    "frameworkUrl": "/asset3d/honghu/Build/Build.framework.js",
    "codeUrl": "/asset3d/honghu/Build/Build.wasm",
    "streamingAssetsUrl":"/asset3d/honghu/AssetBundles/WebGL",
    "companyName": "DefaultCompany",
    "productName": "NewHH",
    "productVersion": "0.1"
  },
  "EQRunInterval": 60000,
  "RTDataInterval": 10000,
  "HACCPInterval": 300000,
  "controls":{
    "SafetyPanel.AccessControlRecord": true,     
    "SafetyPanel.FloodSafety": true,
    "SafetyPanel.FloodRehearse": true
  },
  "defaultFloor": "-1",
  "onlineFloorKeys": ["-1", "-2"],
  "floors":[
     {
      "label": "鸟瞰图",
      "value": "0",
      "icon": "dimian",
      "view": "-49.1, 6.6, 49.9,179.9781,40,35.5468,58.14552"
    },
    {
      "label": "总览",
      "value": "-4",
      "icon": "zonglan",
      "view": "-54.4, 40.0, -48.1,180.151,39,120.573,194.7931"
    },
    {
      "label": "负一层",
      "value": "-1",
      "icon": "fuyiceng",
      "view": "-46.9, 1.0, 0.4,0,40,32.5,63.35202"
    },
    {
      "label": "负二层",
      "value": "-2",
      "icon": "fuerceng",
      "view": "-46.9, 1.0, 0.4,0,40,32.5,63.35202"
    },
    {
      "label": "负三层",
      "value": "-3",
      "icon": "fusanceng",
      "view":  "10.8, 13.6, 4.9,89.12034,33,7.383321,12.4508"
    }
  ],
  "pointnames":[
      "进厂水质",
      "出厂水质",
      "鼓风机#1",
      "鼓风机#2",
      "鼓风机#3",
      "膜池鼓风机#1",
      "膜池鼓风机#2",
      "膜池鼓风机#3",
      "中水",
      "膜池",
      "生化好氧",
      "生化缺氧",
      "生化厌氧",
      "精细格栅",
      "速沉池",
      "细格栅",
      "曝气沉砂池",
      "污泥池"
  ],
  "toolsOptions": [
    {
      "key": "Home",
      "floors": [
        "0",
        "-1",
        "-2",
        "-3",
        "-4"
      ]
    },
    {
      "key": "View",
      "floors": [
        "0",
        "-1",
        "-2",
        "-3",
        "-4"
      ]
    },
    {
      "key": "RTData",
      "floors": [
        "-1",
        "-2"
      ],
      "initValue": true
    },
    {
      "key": "AirDucts",
      "floors": [
        "-1"
      ]
    },
    {
      "key": "Water",
      "floors": [
        "-2"
      ],
      "initValue": true
    },
    {
      "key": "Glass",
      "floors": [
        "-1"
      ],
      "initValue": true
    },
    {
      "key": "Perspective",
      "floors": [
        "-1"
      ]
    },
    {
      "key": "WorkAreas",
      "floors": [
        "-1"
      ],
      "options": [
        {
          "label": "第四分区",
          "value": 4
        },
        {
          "label": "第五分区",
          "value": 5
        },
        {
          "label": "第六分区",
          "value": 6
        },
        {
          "label": "第七分区",
          "value": 7
        },
        {
          "label": "第八分区",
          "value": 8
        },
        {
          "label": "第九分区",
          "value": 9
        }
      ]
    },
    {
      "key": "SegmentAnimation",
      "floors": [
        "-2"
      ]
    }
  ]
}`,flowChartConfig:`{"data":[{"id":"2987eac5-9c0e-4955-9de1-2ce20db75028","title":"工艺总图"},{"id":"0f1ae879-357f-4af1-95fb-199a5900949e","title":"智能工艺控制"},{\r      "title": "泵站",\r      "id":"menu1",\r      "children":[\r          {"id":"966f5e86-b3b0-47c0-9ebc-d99fc8d01f54","title":"宝安路泵站"},\r          {"id":"cb72ada3-50ab-463e-b702-66f752ac5c36","title":"洪湖泵站"}\r      ]\r    },{"id":"97195982-9cba-4b0e-aa4a-c6a811e0e1de","title":"细格栅"},{"id":"9cfe6a3d-d4e7-47eb-8cba-1d8daa2226b3","title":"速沉池"},{\r      "title": "加药间",\r      "id":"menu2",\r      "children":[\r          {"id":"a5a2e3e8-3643-4656-b55a-df67c1f65b2b","title":"乙酸钠加药间"},\r          {"id":"c459ff4d-5b48-42c2-b6c1-ab153192ac30","title":"PAC加药间"}\r      ]\r    },{"id":"43cf3edc-335e-48be-aa1b-2c4ce7c797e1","title":"精细格栅"},{"id":"5436ff12-19e8-4c03-b355-73780a5f1d4d","title":"生化池"},{"id":"3409d2b3-63de-43bb-a0b5-cc919e0b3cdc","title":"生化池鼓风机"},{"id":"395749fd-e8c3-4fa9-a006-719604f2555e","title":"膜池"},{"id":"916c29d9-49fa-4361-8b95-c248c0007121","title":"膜池鼓风机"},{"id":"c331d08c-ce84-4205-b677-01a1e2dac68e","title":"污泥泵房"},{"id":"523bed55-ad11-444e-9ab8-2778fa5a79f4","title":"除臭系统"}]}`,externalOrgCode:`B967`},id:2001},{code:`SZBSNL`,name:`南岭泵站`,businessCode:`SZBSNL`,tenantId:`3325c488-798b-0925-763c-39fdcfce5ae7`,threeDimensionalUrl:null,bizType:1,sort:1,extraProperties:{},id:3001},{code:`SZBSJP`,name:`截排站`,businessCode:`SZBSJP`,tenantId:`3325c488-798b-0925-763c-39fdcfce5ae7`,threeDimensionalUrl:null,bizType:1,sort:2,extraProperties:{},id:3002},{code:`SZBSDZT`,name:`丹竹头`,businessCode:`SZBSDZT`,tenantId:`3325c488-798b-0925-763c-39fdcfce5ae7`,threeDimensionalUrl:null,bizType:1,sort:3,extraProperties:{},id:3003},{code:`SZBSGK`,name:`甘坑`,businessCode:`SZBSGK`,tenantId:`3325c488-798b-0925-763c-39fdcfce5ae7`,threeDimensionalUrl:null,bizType:1,sort:4,extraProperties:{},id:3004},{code:`SZBSLHS`,name:`莲花水`,businessCode:`SZBSLHS`,tenantId:`3325c488-798b-0925-763c-39fdcfce5ae7`,threeDimensionalUrl:null,bizType:1,sort:5,extraProperties:{},id:3005},{code:`YDPSBZ`,name:`排水泵站`,businessCode:`YDPSBZ`,tenantId:`32e955ca-37f0-cb39-bbf7-39f9dd66dc9d`,threeDimensionalUrl:null,bizType:2,sort:5,extraProperties:{},id:3101},{code:`NSBZGLS`,name:`南山泵站管理所`,businessCode:`NSBZGLS`,tenantId:`86cfd7c1-72f9-36da-6fe8-39fdaa8250cb`,threeDimensionalUrl:null,bizType:3,sort:6,extraProperties:{isTrashSource:!1,mapSubTitle:`NANSHANBENGZHANGUANLISUO`,mapCoord:`113.931907,22.565399`,mapPolygonCoords:``,mapArea:`南山区`,flowChartConfig:`{"data":[ \r
 { "title": "前海片区",\r
      "id":"menu1",\r
      "children":[\r
        {"id":"b8f48dc3-86a4-41ea-9cf4-b137988ee909","title":"创业路泵站"},\r
        {"id":"95698bab-9806-4c86-ab39-a69c65526e33","title":"蛇口5#泵站"},\r
        {"id":"2129b02d-1c74-40b7-87b4-b82935bfc2e7","title":"蛇口4#泵站"},\r
        {"id":"63ef4044-bcf0-43be-94fb-2962c74d7176","title":"板桥雨污水泵站"},\r
        {"id":"1768244b-692f-40af-ab6b-f23418e8dcb7","title":"登良泵站"},\r
        {"id":"d8f2a27f-e57b-4712-a8d0-4c6732abc8c5","title":"前海雨污水泵站"},\r
        {"id":"5ed19721-44b8-4094-9fd2-7eac2fffd0b3","title":"工业区1#泵站"},\r
        {"id":"b3bf92f4-fa3f-426e-aa72-deab7b4c0bbf","title":"工业区2#泵站"},\r
        {"id":"f74c86b0-10af-4884-af5f-9a06e2fdb207","title":"工业区3#泵站"},\r
        {"id":"917abc6a-3562-425b-b959-4e3ccf1e719a","title":"工业区4#泵站"},\r
        {"id":"037bbc5a-4e4b-4159-99f9-43de1e761466","title":"赤湾1#泵站"},\r
        {"id":"67abb6c9-9231-4ddf-af85-885ac77a8eaf","title":"赤湾2#泵站"},\r
        {"id":"6033a3e5-3ffc-4eda-a9aa-bed7c279fbb6","title":"前海湾泵站"},\r
        {"id":"edf74d9b-e055-4f67-98a9-fadd3800d4e6","title":"关口渠泵站"},\r
        {"id":"1d58be30-667a-4875-8d26-bb32b680fe7a","title":"郑宝坑渠泵站"},\r
        {"id":"c63138bb-3df7-462d-ad57-677de6d0f7c6","title":"桂庙渠泵站"},\r
        {"id":"e7cac7ad-0896-41f6-ad23-28d3fe55b03e","title":"海斯比泵站"},\r
        {"id":"af2d138c-75e0-4811-87d3-256f3c68da1c","title":"后海村泵站"},\r
        {"id":"2a217378-a10d-4bb9-ab42-8c58bf5d9754","title":"南山村泵站"},\r
        {"id":"ad20e26f-1c8e-42e7-a3fd-e7030be4a991","title":"新圳河截污泵站"},\r
        {"id":"999f1f83-bd83-48f2-80df-d0408622e665","title":"3号闸"},\r
        {"id":"704de8a3-7553-4eb5-a84d-ae9679e1378a","title":"西部通道1#"}]},\r
        \r
  { "title": "后海片区",\r
      "id":"menu2",\r
      "children":[\r
      {"id":"b3441244-f4a5-498d-9af3-9ce7e28805fc","title":"华侨城泵站"},\r
      {"id":"305d2ba8-88a4-4a27-8e69-f7904d3fe1e0","title":"白石洲泵站"},\r
      {"id":"27300370-60a8-4dfe-95e8-4509380629c8","title":"龙井泵站"},\r
      {"id":"3a628730-0f9f-4691-acfb-5469fb58a3d6","title":"后海泵站"},\r
      {"id":"425e54c7-8f07-4893-8a58-b37756189a24","title":"大沙河河口泵站"},\r
      {"id":"e71c3e68-ac94-4d24-9b8a-7756883bee85","title":"华侨城湿地泵站"},\r
      {"id":"7ef518bc-9d14-46c1-ae5f-32eb3537b08e","title":"沙河西污水泵站"},\r
      {"id":"d97c827c-13f7-4781-bbed-2090301dd70c","title":"沙河四村泵站"},\r
      {"id":"20891345-718a-407b-acce-ec1ecbb57f61","title":"西部通道2#"},\r
      {"id":"c020995c-b61b-42b5-be45-82d966e8d529","title":"滨海大道地下泵房1#"},\r
      {"id":"72828943-85b7-46a2-8641-884eeb77a5e2","title":"滨海大道地下泵房2#"},\r
      {"id":"c981266a-fba1-4d2f-8b44-c85552aadb91","title":"滨海大道地下泵房3#"},\r
      {"id":"f00fabf4-ca38-467f-ab64-d09c7c66b874","title":"大涌转输泵站"}\r
      ]},\r
      \r
      { "title": "西丽片区",\r
      "id":"menu3",\r
      "children":[\r
      {"id":"68e60182-32bb-4d28-90a7-adb0b090878a","title":"王京坑泵站"},\r
      {"id":"46ceed80-eede-4917-8018-69f447e78a06","title":"大勘村泵站"},\r
      {"id":"b9c3ab57-d876-4cc7-94f9-0307c6d21451","title":"麒麟山泵站"},\r
      {"id":"a9cd59dd-a04f-44ab-9a9b-e210fc8d36db","title":"百旺泵站"},\r
      {"id":"a2838380-6b92-4b1b-b6d2-fa783df765bb","title":"牛城泵站"},\r
      {"id":"5db9289f-7bc8-4631-962d-8e8ad427e20e","title":"白芒2#泵站"},\r
      {"id":"93c3905a-0951-4faf-aabe-ec2a371f87ef","title":"铁岗原水泵站"},\r
      {"id":"9aa43de7-fdb4-450d-b292-02d0b05cb8fe","title":"西丽加药站"}\r
      ]}\r
]}`,externalOrgCode:`b1023`},id:3201},{code:`FTBZGLS`,name:`福田泵站管理所`,businessCode:`FTBZGLS`,tenantId:`80a43d7f-0aa8-0f38-974a-39fe6e4c32fb`,threeDimensionalUrl:null,bizType:3,sort:2,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:`114.058126,22.545218`,mapPolygonCoords:``,mapArea:`福田区`,externalOrgCode:`b1566`},id:3301},{code:`LHBZGLS`,name:`罗湖泵站管理所`,businessCode:`LHBZGLS`,tenantId:`10345868-194a-a2f6-2830-39f40ea2f376`,threeDimensionalUrl:null,bizType:3,sort:3,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:`114.130215,22.555364`,mapPolygonCoords:``,mapArea:`罗湖区`,flowChartConfig:`{
  "data": [
    
     {
      "id": "e7bb21b2-f78a-48e4-9ad4-0d2b17ab66e0",
      "title": "东湖原水泵站"
    },
    
    
    {
      "title": "排水泵站",
      "id":"menu2",
      "children":[
         {
      "id": "80ba8b4c-2e4f-4f35-afd2-1f4f27ba8984",
      "title": "宝安路泵站"
    },
    {
      "id": "f225ebf8-ef81-45cb-9285-d650d1c5c188",
      "title": "东门泵站"
    },
    {
      "id": "cfd4f2b5-5df5-4951-ab47-a334d6f5471b",
      "title": "罗雨干渠一体化泵站"
    },
    {
      "id": "4a926774-7e90-4789-a7c6-7d0bc1ade839",
      "title": "清水河一体化泵站"
    },
    {
      "id": "e6a1c277-a04a-4b01-9cef-935b9a701120",
      "title": "高涧河一体化泵站"
    },
    {
      "id": "244da241-7782-42f0-96f4-26502e928b60",
      "title": "草埔一体化泵站"
    },
    {
      "id": "3b07e74b-7a9f-4ae6-b23d-1303d5bcfc8c",
      "title": "宝安南地下通道泵站"
    },
    {
      "id": "c095d8ec-766c-4b19-9c95-09c18db33647",
      "title": "向西北地下通道泵站"
    },
    {
      "id": "f26f94f0-08f9-46b8-87aa-4090038f4609",
      "title": "布吉地下通道泵站"
    },
    {
      "id": "44aa2406-be98-4b33-90ff-e3ddd3faba9e",
      "title": "兰科泵站"
    },
    {
      "id": "5f37449e-d6a0-4c98-a863-e48e680d0c37",
      "title": "正坑泵站"
    },
    {
      "id": "d79a8230-279a-46e8-87fb-b145900cdd53",
      "title": "和平泵站"
    },
    {
      "id": "1a839d8c-2b5b-4d20-9f03-c700cee79db1",
      "title": "罗雨泵站"
    },
    {
      "id": "69607617-5f42-41d1-a6af-93779c42e3cf",
      "title": "蔡屋围泵站"
    },
    {
      "id": "5ab06f70-c6d7-4cdb-be8e-4d9aa3a9de0a",
      "title": "洪湖泵站"
    },
    {
      "id": "6eb155f6-e879-4139-90cc-8805ee640fc0",
      "title": "大小坑泵站"
    },
    {
      "id": "3166a5fc-2ad7-410c-88c4-4332e7a0ba47",
      "title": "北斗泵站"
    },
    {
      "id": "614261b8-99da-40ef-9dba-36885dfc756e",
      "title": "新秀泵站"
    },
    {
      "id": "91ff802e-b769-47a5-be8c-1b4c766b8308",
      "title": "东湖排水泵站"
    },
    {
      "id": "264ea281-fac0-4617-892f-769eb1e40341",
      "title": "大望泵站"
    },
    {
      "id": "ee6a0b37-9f82-48b3-8963-1ce40c643782",
      "title": "沙湾泵站"
    } 
      ]
    }
    
    
    
    
    
    
    
   
   
  ]
}`,externalOrgCode:`bz001`},id:3401},{code:`BABZGLS`,name:`宝安泵站管理所`,businessCode:`BABZGLS`,tenantId:`3325c488-798b-0925-763c-39fdcfce5ae7`,threeDimensionalUrl:null,bizType:3,sort:4,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:`113.880245,22.620317`,mapPolygonCoords:``,mapArea:`宝安区`,externalOrgCode:`b1024`},id:3501},{code:`YTBZGLS`,name:`盐田泵站管理所`,businessCode:`YTBZGLS`,tenantId:`32e955ca-37f0-cb39-bbf7-39f9dd66dc9d`,threeDimensionalUrl:null,bizType:3,sort:5,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:`114.260158,22.555102`,mapPolygonCoords:``,mapArea:`盐田区`,externalOrgCode:`b1025`},id:3502},{code:`LGBZGLS`,name:`龙岗泵站管理所`,businessCode:`LGBZGLS`,tenantId:`3325c488-798b-0925-763c-39fdcfce5ae7`,threeDimensionalUrl:null,bizType:3,sort:6,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:`114.240336,22.720485`,mapPolygonCoords:``,mapArea:`龙岗区`,externalOrgCode:`b1026`},id:3503},{code:`QHBZ`,name:`前海泵站`,businessCode:`QHBZ`,tenantId:`86cfd7c1-72f9-36da-6fe8-39fdaa8250cb`,threeDimensionalUrl:null,bizType:3,sort:7,extraProperties:{isTrashSource:!1,mapSubTitle:``,mapCoord:`113.900174,22.530266`,mapPolygonCoords:``,mapArea:`南山区`,externalOrgCode:`b1027`},id:3504},{code:`TEST01`,name:`测试水厂01`,businessCode:`TEST01`,tenantId:`8b80cee7-7907-a2ea-4db5-39fa5e5090d8`,threeDimensionalUrl:null,bizType:2,sort:3,extraProperties:{},id:9001}]}.data;return t.forEach(e=>{if(e.extraProperties=e.extraProperties||{},e.mapCoord=[],e.mapPolygonCoords=[],e.mapSubTitle=e.extraProperties.mapSubTitle,e.mapArea=e.extraProperties.mapArea,e.orderType=e.extraProperties.orderType,e.extraProperties.mapCoord&&(e.mapCoord=e.extraProperties.mapCoord.split(`,`).map(e=>parseFloat(e))),e.extraProperties.mapPolygonCoords){let t=e.extraProperties.mapPolygonCoords.split(`;`);for(let n of t)e.mapPolygonCoords.push(n.split(`,`).map(e=>parseFloat(e)))}}),t}},T=`
varying vec3 vPosition;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vPosition = position;
}
`,xe=`
  uniform float iTime;
  varying vec2 vUv;
  uniform vec3 color;
  uniform bool animate;
  void main(void) {
      float d = length(vUv - vec2(0.5));

      // 内圆实心：窄过渡带，边缘清晰不发虚
      float core = 1.0 - smoothstep(0.088, 0.099, d);

      // 静态基础外环：半径 0.26，环宽半幅 0.028，边缘清晰
      float baseRing = 1.0 - smoothstep(0.0, 0.028, abs(d - 0.26));

      // 向外扩散的脉冲波纹（animate 选中时）：两圈错位相位，由内向外扩大并渐隐
      float pulse = 0.0;
      if (animate) {
        for (int k = 0; k < 2; k++) {
          float phase = fract(iTime / 2.5 + float(k) * 0.5);
          float pr = mix(0.12, 0.45, phase);
          float pw = 0.025 + phase * 0.035;
          float ringK = 1.0 - smoothstep(0.0, pw, abs(d - pr));
          pulse += (1.0 - phase) * ringK * (k == 0 ? 0.6 : 0.35);
        }
      }

      float alpha = clamp(core + baseRing * 0.85 + pulse, 0.0, 1.0);
      gl_FragColor = vec4(color, alpha);
  }`,Se=`
  uniform vec3 color;
  uniform float iTime;
  varying vec2 vUv;
  void main() {
    // 纵向：底部实、顶部渐隐
    float vert = 1.0 - vUv.y;
    vert = pow(clamp(vert, 0.0, 1.0), 1.3);
    // 沿光柱缓慢上升的流光
    float flow = 0.5 + 0.5 * sin(vUv.y * 18.0 - iTime * 2.5);
    float alpha = vert * (0.45 + 0.30 * flow);
    gl_FragColor = vec4(color, alpha);
  }
`,Ce=`
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,we=`
  uniform vec3 lineColor;    // 高亮边框颜色
  uniform float uOpacity;    // 边框透明度（1.0 实心，越低越淡、半透明）
  void main() {
    gl_FragColor = vec4(lineColor, uOpacity);
  }
`,Te=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,Ee=`
  uniform vec3 lineColor;    // 边线基础冷蓝
  uniform vec3 hiColor;       // 流光头部高亮青
  uniform float iTime;
  uniform float uSpeed;       // 巡游速度（圈/秒）
  uniform float uPhase;       // 环间错峰相位 0~1
  uniform float uCount;        // 每条环上的流光条数
  uniform float uTail;        // 单条拖尾长度（弧长占比 0~1）
  uniform float uOpacity;     // 整体透明度
  varying vec2 vUv;

  void main() {
    float u = vUv.x;

    float bestCore = 0.0;
    float bestTail = 0.0;
    // 一条环上均匀铺 uCount 个流光，相邻间隔 1/uCount
    for (int k = 0; k < 32; k++) {
      if (float(k) >= uCount) break;
      float head = fract(iTime * uSpeed + uPhase + float(k) / uCount);
      // ahead：头部前方距离；behind：头部身后距离（环形 0~1）
      float ahead  = fract(u - head);
      float behind = fract(head - u);
      // 头部亮核：前方贴近头部处最亮
      float core = 1.0 - smoothstep(0.0, 0.05, ahead);
      // 身后拖尾：指数衰减，尾长限制在 uTail 弧长内
      float tailMask = 1.0 - smoothstep(uTail * 0.66, uTail, behind);
      float tail = exp(-behind * 6.5) * tailMask;
      bestCore = max(bestCore, core);
      bestTail = max(bestTail, tail);
    }

    vec3 col = mix(lineColor, hiColor, bestCore);
    // 常驻微光边线 + 拖尾 + 亮核
    float alpha = clamp(0.10 + bestTail * 0.6 + bestCore * 1.2, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha * uOpacity);
  }
`,De=`
#define PI 3.14159265359

// ================= 可配置参数 =================
const float R_OUTER = 360.0;   // 最外层半径（像素）
const float EDGE_SOFT = 3.0;   // 环带径向边缘柔化（像素）
const float GAP_SOFT  = 0.04;  // 缺口端点柔化（弧度）

// 外圈（索引 0）：半径 R，4 缺口，线宽 30，缺口弧长 180，透明度 0.3，冷蓝
const float O_LINE = 30.0;
const float O_GAP  = 180.0;
const float O_ALPHA = 0.3;
const float O_GAP_COUNT = 4.0;
const float O_SPEED = 0.15;    // 外圈切口转速（弧度/秒，正负=方向）
const float O_PHASE = 0.0;    // 外圈切口初始相位（弧度）

// 中圈（索引 1）：半径 2/3 R，4 缺口，线宽 10，缺口弧长 200，透明度 0.8，高亮冷蓝
const float M_RADIUS = 2.0 / 3.0;
const float M_LINE = 10.0;
const float M_GAP  = 200.0;
const float M_ALPHA = 0.8;
const float M_GAP_COUNT = 4.0;
const float M_SPEED = -0.10;  // 中圈切口转速（反向）
const float M_PHASE = 1.2;

// 内圈（索引 2）：半径 1/3 R，无缺口，线宽 100，透明度 0.5，冷蓝
const float I_RADIUS = 1.0 / 3.0;
const float I_LINE = 100.0;
const float I_ALPHA = 0.5;
const float I_GAP_COUNT = 0.0;
const float I_SPEED = 0.08;
const float I_PHASE = 2.4;

// 中心向外扩散的脉冲波纹（参数直接配置在 shader 内）
const vec3  PULSE_COLOR  = vec3(0.0, 0.93, 1.0);  // 扩散圈颜色
const float PULSE_WIDTH  = 4.0;    // 环粗（中心带半幅）
const float PULSE_EDGE   = 1.5;    // 边缘柔化半幅（越小越清晰）
const float PULSE_ALPHA  = 0.65;  // 峰值透明度
const float PULSE_SPEED  = 60.0;   // 扩散速度（半径/秒）
const float PULSE_COUNT   = 3.0;   // 同时跑几圈错位波纹
// =============================================

uniform vec3 baseColor;   // 冷蓝（外/内圈）
uniform vec3 hiColor;     // 高亮冷蓝（中圈）
uniform float iTime;
uniform vec2 iResolution;
uniform float uReveal;    // 扩散进度 0~1：三圈从中心向外展开并渐显
varying vec2 vUv;

void main() {
  vec2 uv = vec2(vUv.x * iResolution.x, vUv.y * iResolution.y);
  vec2 c = iResolution * 0.5;
  vec2 d = uv - c;
  float r = length(d);
  float theta = atan(d.y, d.x);

  float radii[3];
  radii[0] = R_OUTER;
  radii[1] = R_OUTER * M_RADIUS;
  radii[2] = R_OUTER * I_RADIUS;

  float lineW[3];  lineW[0] = O_LINE;  lineW[1] = M_LINE;  lineW[2] = I_LINE;
  float gapArc[3]; gapArc[0] = O_GAP;  gapArc[1] = M_GAP;  gapArc[2] = 0.0;
  float gapCnt[3]; gapCnt[0] = O_GAP_COUNT; gapCnt[1] = M_GAP_COUNT; gapCnt[2] = I_GAP_COUNT;
  float alpha[3];  alpha[0] = O_ALPHA; alpha[1] = M_ALPHA; alpha[2] = I_ALPHA;
  float speed[3];  speed[0] = O_SPEED; speed[1] = M_SPEED; speed[2] = I_SPEED;
  float phase[3];  phase[0] = O_PHASE; phase[1] = M_PHASE; phase[2] = I_PHASE;
  float hi[3];     hi[0] = 0.0;        hi[1] = 1.0;        hi[2] = 0.0;

  vec3 col = vec3(0.0);
  float alphaSum = 0.0;

  for (int i = 0; i < 3; i++) {
    float radius = radii[i] * uReveal;
    float halfW = lineW[i] * 0.5;
    float e0 = max(0.0, halfW - EDGE_SOFT);
    float e1 = halfW + EDGE_SOFT;
    float band = 1.0 - smoothstep(e0, e1, abs(r - radius));

    float mask = band;
    if (gapCnt[i] > 0.5) {
      float rot = iTime * speed[i] + phase[i];
      float sector = 2.0 * PI / gapCnt[i];
      float local = mod(theta - rot, sector);
      float ad = abs(local - sector * 0.5);
      float gapHalf = (gapArc[i] / radius) * 0.5;
      float gap = smoothstep(gapHalf, gapHalf + GAP_SOFT, ad);
      mask = band * gap;
    }

    vec3 ringCol = mix(baseColor, hiColor, hi[i]);
    float ringAlpha = mask * alpha[i] * uReveal;
    col += ringCol * ringAlpha;
    alphaSum += ringAlpha;
  }

  // 中心向外扩散的脉冲波纹：多圈错位相位，由内向外扩大并渐隐
  for (int k = 0; k < 2; k++) {
    if (float(k) >= PULSE_COUNT) break;
    float offset = float(k) * R_OUTER / PULSE_COUNT;
    float pr = mod(iTime * PULSE_SPEED + offset, R_OUTER);
    float bandP = 1.0 - smoothstep(PULSE_WIDTH - PULSE_EDGE, PULSE_WIDTH + PULSE_EDGE, abs(r - pr));
    float fade = 1.0 - pr / R_OUTER;
    float pulseAlphaV = bandP * fade * PULSE_ALPHA * uReveal;
    col += PULSE_COLOR * pulseAlphaV;
    alphaSum += pulseAlphaV;
  }

  gl_FragColor = vec4(col, clamp(alphaSum, 0.0, 1.0));
}
`,Oe={class:`map-container`},ke={key:0,class:`footer`},Ae={class:`foot-nav`},je=[`onClick`],Me={class:`nav-text`},Ne={class:`info-box`},Pe={class:`info-content`},Fe={class:`name`},Ie={class:`value`},Le={class:`unit`},Re=9430783,ze=.25,Be=3,Ve=5.06,He=350,Ue=700,E=f({__name:`index`,setup(f){let E={techBgTex:`/3d/source/tietu/Tech_021.png`,diffuseTex:`/3d/source/tietu/manshe_h.png`,bumpTex:`/3d/source/tietu/dem.png`,geoJson:`/3d/source/深圳市.json`,cityOutline:`/3d/source/深圳市-city.json`},We=s(null),Ge=s(null),D=s(!0),O=s(0),k=null,A=null,j=null,M=new b,N=new b,P=new b,F=null,I=null,L=null,R=null,z=null,B=[],V=null,H=null,U=0,W=s(null),G=s(!1),Ke=s([]),qe=[{name:`宝安区`,position:{x:-43.85707054323405,y:5,z:-3.8569488892345327}},{name:`光明区`,position:{x:-33.89367959864091,y:5,z:-18.70377690382958}},{name:`龙华区`,position:{x:-20.791392249007615,y:5,z:-8.04661735891984}},{name:`龙岗区`,position:{x:1.4430810801444973,y:5,z:-7.906977311650373}},{name:`坪山区`,position:{x:23.008000562118,y:5,z:-8.552855612845365}},{name:`大鹏新区`,position:{x:43.02894601290143,y:5,z:10.854145262604652}},{name:`南山区`,position:{x:-34.67715635549325,y:5,z:15.152619970603602}},{name:`福田区`,position:{x:-18.4557872886727,y:5,z:12.436954685944727}},{name:`罗湖区`,position:{x:-3.820589246963976,y:5,z:7.662604891478809}},{name:`盐田区`,position:{x:10.840856944882267,y:5,z:5.901830331234198}}],K=[`#00FFF6`,`#FEDA33`,`#2BA7FF`],q=s([{lable:`水厂`,alias:`SHUICHANG`,className:`active1`,value:1,points:[]},{lable:`水质净化厂`,alias:`SHUIZHIJINGHUACHANG`,className:`active2`,value:2,points:[]},{lable:`泵站`,alias:`BENGZHAN`,className:`active3`,value:3,points:[]}]),Je=0,J=0,Y=!1,X=()=>{Je+=1,J=Math.min(100,Math.round(Je/Be*100))},Ye=(e,t,n=1)=>{let r=new te;r.setFromPoints(e.map(e=>new S(e.x,e.y)));let i=r.getPoints(),a=new ne().setFromPoints(i),o=new y({uniforms:{lineColor:{value:new _(t)},uOpacity:{value:n}},vertexShader:Ce,fragmentShader:we,transparent:!0});o.color=o.uniforms.lineColor.value,o.borderOpacity=o.uniforms.uOpacity;let s=new re(a,o);return s.computeLineDistances(),s},Z={count:2,tail:.52,speed:.18,radius:.11},Xe=async()=>{let e=await(await fetch(E.geoJson)).json(),t=new b,n=[];e.features.forEach(e=>{e.geometry.coordinates.forEach(r=>{let i=new pe,a=[];r.forEach(e=>{e.forEach((e,t)=>{let{x:n,y:r}=k.projectPlane(e[0],e[1]);t===0?i.moveTo(n,r):i.lineTo(n,r),a.push(new C(n,r,0))})}),n.push(i);let o=Ye(a,Re,ze);e.geometry.coordinates.length===4?t.add(o):(o.rotateX(-Math.PI/2),o.position.y=5.05,M.add(o))}),e.geometry.coordinates.length===4&&(t.rotateX(-Math.PI/2),t.position.y=5.05,M.add(t))});let r=new oe(n),i=r.attributes.position,a=r.attributes.uv,o=1/0,s=-1/0,c=1/0,l=-1/0;for(let e=0;e<i.count;e++){let t=i.getX(e),n=i.getY(e);t<o&&(o=t),t>s&&(s=t),n<c&&(c=n),n>l&&(l=n)}let u=Math.min(.9/(s-o),.5183/(l-c)),d=(o+s)/2,f=(c+l)/2;for(let e=0;e<a.count;e++)a.setXY(e,.5085+(i.getX(e)-d)*u,.5185+(i.getY(e)-f)*u);a.needsUpdate=!0;let p=new x(r,new me({map:I,bumpMap:L,bumpScale:.5,emissiveMap:I,emissive:new _(16777215),emissiveIntensity:.35,color:16777215,metalness:.1,roughness:.85}));p.rotateX(-Math.PI/2),p.position.y=5,M.add(p);let m=new x(new ie(n,{depth:4.8,bevelEnabled:!1}),[new ue({visible:!1}),new ye({fresnelScale:.45,color:729651,fresnelColor:4179711,doubleSide:!1})]);m.rotateX(-Math.PI/2),m.position.y=.2,M.add(m),A.add(M),X()},Ze=e=>{let t=new b,n=e.length;e.forEach((e,r)=>{if(e.length<3)return;let i=new se;i.moveTo(e[0].x,e[0].y);for(let t=1;t<e.length;t++)i.lineTo(e[t].x,e[t].y);let a=[];i.subPaths.forEach(e=>a.push(...e.getPoints(1)));let o=a.map(e=>new C(e.x,0,-e.y)),s=new le;for(let e=0;e<o.length-1;e++)s.curves.push(new g(o[e],o[e+1]));s.curves.push(new g(o[o.length-1],o[0]));let c=new fe(s,Math.max(48,o.length),Z.radius,6,!0),l=new y({uniforms:{lineColor:{value:new _(4179711)},hiColor:{value:new _(61183)},iTime:{value:0},uSpeed:{value:Z.speed},uPhase:{value:n?r/n:0},uCount:{value:Z.count},uTail:{value:Z.tail},uOpacity:{value:1}},vertexShader:Te,fragmentShader:Ee,transparent:!0,depthWrite:!1,blending:2}),u=new x(c,l);u.position.y=Ve,t.add(u)}),M.add(t)},Qe=async()=>{let e=await(await fetch(E.cityOutline)).json(),t=[];e.features.forEach(e=>{e.geometry.coordinates.forEach(e=>{let n=e[0],r=[];n.forEach(e=>{let{x:t,y:n}=k.projectPlane(e[0],e[1]);r.push({x:t,y:n})}),t.push(r)})}),Ze(t)},$e=()=>{let e=new ge;F=e.load(E.techBgTex,()=>X(),void 0,()=>X()),I=e.load(E.diffuseTex),I.colorSpace=ae,I.wrapS=I.wrapT=v,L=e.load(E.bumpTex),L.wrapS=L.wrapT=v},et=()=>{let e=new h(900,750,64),t=new x(e,new he({map:F,emissive:new _(16777215),emissiveMap:F,emissiveIntensity:.4,transparent:!0,blending:2}));t.rotateX(-Math.PI/2),t.position.z=-1,M.add(t),k.addFloorReflection(t,{reflectStrength:.75,fresnelPower:1,color:10475775});let n=new h(150,162e3/1920,64),r=new y({uniforms:{iTime:{value:0},baseColor:{value:new _(4179711)},hiColor:{value:new _(61183)},iResolution:{value:new S(1500,162e4/1920)},uReveal:{value:0}},transparent:!0,depthWrite:!1,side:0,vertexShader:T,fragmentShader:De,blending:2});R=r;let i=new x(n,r);i.rotateX(-Math.PI/2),i.position.y=.1,M.add(i)},tt=()=>{qe.forEach(e=>{let t=k.createText({element:e.name,className:`city-area`,type:`3d`,position:e.position});t.scale.set(0,0,0),t.rotateX(-Math.PI/2),N.add(t)}),A.add(N),N.visible=!1},nt=()=>{A.add(P)},rt=new de(15,64),it=new ce(2.8,4.2,48,16,1,!0);it.translate(0,24,0);let at=(e,t)=>{t.forEach(t=>{let n=document.createElement(`div`);n.className=`tipElement`,n.innerText=t.name,n.style.color=K[e];let r=k.createText({element:n,className:`tipElement`,type:`3ds`});r.visible=!1,r.scale.set(.8,.8,.8),n.style.opacity=`0`,r.position.set(0,50,0);let i=new y({uniforms:{iTime:{value:0},animate:{value:!1},color:{value:new _(K[e])}},side:0,transparent:!0,vertexShader:T,fragmentShader:xe}),a=new x(rt,i);a.name=t.businessCode,a.rotation.x=-Math.PI/2,a.visible=!1;let o=new y({uniforms:{iTime:{value:0},color:{value:new _(K[e])}},vertexShader:T,fragmentShader:Se,transparent:!0,depthWrite:!1,side:2,blending:2}),s=new x(it,o);s.name=`beam_`+t.businessCode,s.position.y=0,s.visible=!1,s.scale.set(1,0,1);let c=new b;c.add(a),c.add(s),c.add(r),c.userData={mesh:a,beam:s,tip:r},c.position.copy(k.projectToScene(t.mapCoord[0],t.mapCoord[1])),c.scale.set(.1,.1,.1),P.add(c)})},ot=e=>{let{tip:t,mesh:n}=e.userData;if(!t||n&&!n.visible)return;let r=t.element;t.visible=!0;let i={o:0,s:.8};t.scale.set(.8,.8,.8),r&&(r.style.opacity=`0`),new w.Tween(i,!0).to({o:1,s:1},He).easing(w.Easing.Quintic.Out).onUpdate(()=>{t.visible&&(r&&(r.style.opacity=i.o.toFixed(3)),t.scale.set(i.s,i.s,i.s))}).onComplete(()=>{r&&(r.style.opacity=`1`),t.scale.set(1,1,1)}).start()},Q=e=>{let{tip:t}=e.userData;t&&(t.visible=!1,t.element&&(t.element.style.opacity=`0`),t.scale.set(.8,.8,.8))},st=(e,t=0)=>{let{beam:n,tip:r,mesh:i}=e.userData;n&&(n.visible=!0,n.scale.set(1,0,1),Q(e),new w.Tween(n.scale,!0).to({y:1},Ue).easing(w.Easing.Quintic.Out).delay(t).onComplete(()=>{i&&i.visible&&ot(e)}).start())},ct=(e,t)=>{e.on(`hover`,(t,n)=>{k.outlinePass.edgeStrength=2,k.outlinePass.visibleEdgeColor.set(new _(K[W.value-1])),k.setOutlineObjects(e)},()=>{k.clearOutline()}),e.on(`click`,(e,n)=>{ut(e,e.userData.mesh||n,t)})},lt=e=>{let t={1:[{displayName:`今日供水量`,dataValue:`12.6`,dataUnit:`万吨`},{displayName:`出厂浊度`,dataValue:`0.32`,dataUnit:`NTU`},{displayName:`出厂余氯`,dataValue:`0.68`,dataUnit:`mg/L`},{displayName:`pH 值`,dataValue:`7.45`,dataUnit:``}],2:[{displayName:`今日处理量`,dataValue:`9.8`,dataUnit:`万吨`},{displayName:`出水 COD`,dataValue:`26`,dataUnit:`mg/L`},{displayName:`出水氨氮`,dataValue:`1.2`,dataUnit:`mg/L`},{displayName:`出水流量`,dataValue:`320`,dataUnit:`m³/h`}],3:[{displayName:`运行电流`,dataValue:`86.4`,dataUnit:`A`},{displayName:`出口压力`,dataValue:`0.32`,dataUnit:`MPa`},{displayName:`累计提升量`,dataValue:`58.2`,dataUnit:`万吨`},{displayName:`设备状态`,dataValue:`正常`,dataUnit:``}]};return(t[e.bizType]||t[1]).map((t,n)=>({id:`${e.id}-${n}`,...t}))},ut=(e,t,n)=>{if(V!==null&&A.remove(V),n.mapSubTitle===H.querySelector(`.point-note-detail`).innerText&&G.value){G.value=!1,e.userData.tip&&e.userData.mesh&&e.userData.mesh.visible&&ot(e),t.material.uniforms&&t.material.uniforms.animate&&(t.material.uniforms.animate.value=!1);return}G.value=!0,P.traverse(t=>{if(t.userData&&t.userData.mesh&&t.userData.tip&&(t.userData.tip.visible=t!==e&&t.userData.mesh.visible),t.isMesh&&t.material&&t.material.uniforms&&t.material.uniforms.animate)try{t.material.uniforms.animate.value=!1}catch{}}),t.material.uniforms&&t.material.uniforms.animate&&(t.material.uniforms.animate.value=!0);let r=K[(n.bizType||1)-1]||K[0];H.style.setProperty(`--note-color`,r);let i=B.filter(e=>e.factoryId===n.id);Ke.value=i.length?i:lt(n),H.querySelector(`.point-note-title`).innerText=n.name,H.querySelector(`.point-note-detail`).innerText=n.mapSubTitle||n.mapArea||``,V=k.createText({element:H,type:`2d`});let a=new C;e.getWorldPosition(a),V.position.set(a.x,a.y+1.5,a.z),A.add(V)},$=(e,t=!1)=>{V!==null&&(A.remove(V),V=null),W.value=W.value===e?null:e,q.value.forEach((e,n)=>{W.value===null?t?at(n,e.points):e.points.forEach(()=>{P.traverse(e=>{if(e.isMesh){e.parent.offAll(),e.visible=!1;let t=e.parent.userData;t.tip&&Q(e.parent),t.beam&&(t.beam.visible=!1,t.beam.scale.set(1,0,1))}})}):W.value===e.value?e.points.forEach(e=>{P.traverse(t=>{if(t.isMesh&&t.name===e.businessCode){ct(t.parent,e),t.visible=!0;let n=t.parent;if(n.userData.beam.visible=!0,n.userData.beam.scale.set(1,0,1),Q(n),Y&&st(n,0),t.material&&t.material.uniforms&&t.material.uniforms.animate)try{t.material.uniforms.animate.value=!1}catch{}}})}):e.points.forEach(e=>{P.traverse(t=>{if(t.isMesh&&t.name===e.businessCode){t.parent.offAll(),t.visible=!1;let e=t.parent.userData;e.tip&&Q(t.parent),e.beam&&(e.beam.visible=!1,e.beam.scale.set(1,0,1))}})})})},dt=async()=>{try{let e=await be.getAllFactories();z=JSON.parse(JSON.stringify(e)),B=z.filter(e=>e.mapCoord.length>0),q.value.forEach((e,t)=>{q.value[t]={...e,points:B.filter(t=>t.bizType===e.value)}}),nt(),$(null,!0),$(1)}finally{X()}},ft=async()=>{if(Y)return;Y=!0,D.value=!1;let e=k.controls;e&&(e.enableDamping=!1),await k.flyTo(j.position,{x:0,y:100,z:55},1800),N.visible=!0,N.traverse(e=>{e.isCSS3DObject&&(new w.Tween(e.position,!0).to({x:e.position.x+2,y:e.position.y,z:e.position.z},300).easing(w.Easing.Quintic.Out).start(),new w.Tween(e.scale,!0).to({x:.1,y:.1,z:.1},300).easing(w.Easing.Quintic.Out).start())});let t=0;if(P.traverse(e=>{e.userData&&e.userData.beam&&e.userData.mesh&&e.userData.mesh.visible&&(st(e,t*90),t+=1)}),R){let e={v:0};new w.Tween(e,!0).to({v:1},1400).easing(w.Easing.Quintic.Out).onUpdate(()=>{R.uniforms.uReveal.value=e.v}).start()}e&&(e.minDistance=30,e.maxDistance=200,e.enableDamping=!0)},pt=e=>{U+=e,Y||(O.value<J&&(O.value+=(J-O.value)*.12+.4,O.value>J&&(O.value=J)),J>=100&&O.value>=99.5&&(O.value=100,ft())),A&&A.traverse(e=>{if(e.material&&e.material.uniforms)try{e.material.uniforms.iTime.value=U}catch{}})};return n(()=>{k=new _e(We.value,{mode:``,bgColor:661801,environment:!1,shadowMapEnabled:!1,floor:{enabled:!1},fog:{enabled:!0,color:0,near:30,far:300},ambLight:{enabled:!0,color:4210752,intensity:.5},dirLight:{enabled:!0,color:16777215,intensity:.5,position:{x:0,y:30,z:50}},control:{enabled:!0,enableDamping:!0,dampingFactor:.3,zoomSpeed:1,maxDistance:150,autoRotateSpeed:-.2,minPolarAngle:-Math.PI/2,maxPolarAngle:Math.PI/2.2,panLimit:{enabled:!0,min:{x:-40,z:-30},max:{x:40,z:30}}},geo:{center:[114.19,22.63],worldScale:.0012},postProcessing:{enabled:!0,smaa:{enabled:!0},gtao:{enabled:!1},bloom:{enabled:!0,strength:.6,radius:.35,threshold:.35},vignette:{enabled:!0,darkness:.75,offset:1.6},film:{enabled:!1},bokeh:{enabled:!1},outline:{enabled:!0,edgeStrength:5,edgeThickness:1}}}),A=k.scene,j=k.camera,j.position.set(-24.5,135,160),H=Ge.value,$e(),Xe(),Qe(),et(),tt(),dt(),setTimeout(()=>{D.value&&(O.value=100,ft())},8e3),k.animateCallback=pt,k.start()}),e(()=>{k&&=(k.clear(),null),A=null,j=null}),(e,n)=>(t(),u(`div`,Oe,[c(`div`,{ref_key:`container`,ref:We,class:`map-canvas-wrap`},null,512),p(ve,{visible:D.value,progress:O.value,brand:`MAP THREE`,title:`园区场景载入`,status:`正在加载模型资源 · 点位与特效初始化`,accent:`#4fd1ff`,accent2:`#7cf7c4`},null,8,[`visible`,`progress`]),D.value?d(``,!0):(t(),u(`div`,ke,[c(`ul`,Ae,[(t(!0),u(o,null,m(q.value,e=>(t(),u(`li`,{key:e.value,class:r({[e.className]:W.value===e.value})},[c(`div`,{class:r([`border-inner`,{[e.className]:W.value===e.value}]),onClick:t=>$(e.value)},[c(`div`,Me,[c(`h6`,null,i(e.lable),1),c(`span`,null,i(e.alias),1)])],10,je)],2))),128))])])),l(c(`div`,{ref_key:`noteRef`,ref:Ge,class:`point-note`},[n[1]||=c(`div`,{class:`trangle`},null,-1),c(`div`,Ne,[n[0]||=c(`div`,{class:`top-wrap`},[c(`div`,null,[c(`div`,{class:`point-note-title`}),c(`div`,{class:`point-note-detail`})]),c(`span`,{class:`right-icon`})],-1),c(`ul`,Pe,[(t(!0),u(o,null,m(Ke.value,e=>(t(),u(`li`,{key:e.id},[c(`span`,Fe,i(e.displayName),1),c(`span`,Ie,[a(i(e.dataValue),1),c(`span`,Le,i(e.dataUnit),1)])]))),128))])])],512),[[ee,G.value]])]))}},[[`__scopeId`,`data-v-d3f12c45`]]);export{E as default};