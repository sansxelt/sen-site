import * as THREE from './three.module.min.js';
const host = document.getElementById('spatial-scene');
const data = window.LARKSPUR_DATA;
// Offline film capture advances the same scene at exact frame times.
const capture = new URLSearchParams(location.search).get('capture') === '1';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let renderer;
try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:false}); }
catch {
 document.getElementById('view-3d').disabled=true;
 document.getElementById('view-3d').setAttribute('aria-pressed','false');
 document.getElementById('view-2d').setAttribute('aria-pressed','true');
 document.querySelector('.layers').hidden=true;
 document.querySelector('.camera-controls').hidden=true;
 document.getElementById('scene-motion').hidden=true;
 host.dataset.ready='fallback';
}
if (renderer) {
const scene = new THREE.Scene(); scene.background = new THREE.Color('#1c1c1c');
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
let renderScale=Math.min(devicePixelRatio,1.25);
renderer.setPixelRatio(renderScale); renderer.shadowMap.enabled=true; renderer.shadowMap.autoUpdate=false; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','Interactive terrain. Drag to rotate. Control-scroll to zoom. Select contacts using the list.');
renderer.domElement.setAttribute('role','img'); host.prepend(renderer.domElement); host.dataset.ready='true';
const camera = new THREE.OrthographicCamera(-40,40,25,-25,.1,250);
let cameraTransition=null;
const target = new THREE.Vector3(0,0,0); let yaw=.7, pitch=.85, dimension='3d', relief=1, running=!reduced.matches, dragging=false, moved=false, time=0, selected=document.querySelector('.row.sel')?.dataset.id || 'T-1', dirty=true;
scene.add(new THREE.HemisphereLight('#e4e4e4','#272727',2.0));
const sun = new THREE.DirectionalLight('#f1f1f1',2.6); sun.position.set(-30,55,20); sun.castShadow=true; sun.shadow.mapSize.set(512,512); sun.shadow.camera.left=-50;sun.shadow.camera.right=50;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.normalBias=.2;scene.add(sun);
function elevation(x,z) {
 const ridge=7.8*Math.exp(-((x+26)**2+(z+17)**2)/155)+10.5*Math.exp(-((x-30)**2+(z-16)**2)/145)+3*Math.exp(-((x-7)**2+(z+27)**2)/105);
 const rock=(Math.sin(x*.74+z*.24)*Math.cos(z*.59)+.45*Math.sin(x*1.9-z*.71))*.23;
 return (ridge+rock*Math.min(1,ridge/3)+.12*Math.sin(x*.21)*Math.cos(z*.2))*relief;
}
const terrainGeometry = new THREE.PlaneGeometry(106,80,128,96); terrainGeometry.rotateX(-Math.PI/2);
const surfaceColors=new Float32Array(terrainGeometry.attributes.position.count*3);
terrainGeometry.setAttribute('color',new THREE.BufferAttribute(surfaceColors,3));
const detailCanvas=document.createElement('canvas');detailCanvas.width=detailCanvas.height=512;
const detailCtx=detailCanvas.getContext('2d'),detailImage=detailCtx.createImageData(512,512);
for(let i=0;i<detailImage.data.length;i+=4){const x=(i/4)%512,z=Math.floor(i/2048),grain=Math.sin(x*12.9898+z*78.233)*43758.5453,v=220+(grain-Math.floor(grain))*35;detailImage.data[i]=detailImage.data[i+1]=detailImage.data[i+2]=v;detailImage.data[i+3]=255;}
detailCtx.putImageData(detailImage,0,0);const detailTexture=new THREE.CanvasTexture(detailCanvas);detailTexture.wrapS=detailTexture.wrapT=THREE.RepeatWrapping;detailTexture.repeat.set(8,6);detailTexture.colorSpace=THREE.SRGBColorSpace;
const terrain = new THREE.Mesh(terrainGeometry,new THREE.MeshLambertMaterial({color:'#ffffff',vertexColors:true,map:detailTexture}));terrain.receiveShadow=true;scene.add(terrain);
function updateTerrain() {
 renderer.shadowMap.needsUpdate=true;const a=terrainGeometry.attributes.position,colors=terrainGeometry.attributes.color;
 const low=new THREE.Color('#434343'),high=new THREE.Color('#737373'),c=new THREE.Color();
 for(let i=0;i<a.count;i++){const x=a.getX(i),z=a.getZ(i),h=elevation(x,z);a.setY(i,h);c.copy(low).lerp(high,Math.min(1,Math.max(0,h/10)));c.multiplyScalar(.82+.18*(Math.sin(x*.8+z*.4)*Math.cos(z*.65)*.5+.5));colors.setXYZ(i,c.r,c.g,c.b);}
 a.needsUpdate=true;colors.needsUpdate=true;terrainGeometry.computeVertexNormals();
}
updateTerrain();
const topo = new THREE.Group();scene.add(topo);
function updateContours(){
 while(topo.children.length){const old=topo.children[0];topo.remove(old);old.geometry.dispose();old.material.dispose();}
 const verts=[],step=1.4;
 for(let level=.8;level<=17;level+=1.2)for(let x=-38;x<38-step;x+=step)for(let z=-26;z<26-step;z+=step){
  const points=[[x,z],[x+step,z],[x+step,z+step],[x,z+step]],cross=[];
  for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4],ha=elevation(...a),hb=elevation(...b);if((ha<level)!==(hb<level)){const t=(level-ha)/(hb-ha);cross.push([a[0]+(b[0]-a[0])*t,level+.035,a[1]+(b[1]-a[1])*t]);}}
  for(let i=0;i+1<cross.length;i+=2)verts.push(...cross[i],...cross[i+1]);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));topo.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#adadad',transparent:true,opacity:.13})));
}
updateContours();
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(106,.25,80)),new THREE.LineBasicMaterial({color:'#a1a1a1'}));edges.position.y=-.3;// Terrain extends beyond the camera so no floating tabletop edge is visible.
edges.visible=false;
const structures = new THREE.Group(), routes = new THREE.Group(), contacts = new THREE.Group();scene.add(structures,routes,contacts);
const geometryCache=new Map(),materialCache=new Map();
function block(w,h,d,color) {
 const key=[w,h,d].join(':');if(!geometryCache.has(key))geometryCache.set(key,new THREE.BoxGeometry(w,h,d));
 if(!materialCache.has(color))materialCache.set(color,new THREE.MeshLambertMaterial({color}));
 const m=new THREE.Mesh(geometryCache.get(key),materialCache.get(color));m.castShadow=true;m.receiveShadow=true;return m;
}
const buildings=[];
function addBuilding(x,z,w,d,h,i){
 const building=block(w,h,d,i%2?'#6e6e6e':'#8b8b8b');building.position.set(x,elevation(x,z)+h/2,z);structures.add(building);buildings.push({building,x,z,h});
 const roof=block(w+.12,.12,d+.12,'#b2b2b2');roof.position.y=h/2;building.add(roof);
 // Roof seams, plant and windows make the structures identifiable at navigational scale.
 for(let j=0;j<Math.max(2,Math.floor(d/.7));j++){const seam=block(w+.13,.018,.025,'#787878');seam.position.set(0,h/2+.069,-d/2+.35+j*.7);building.add(seam);}
 const plant=block(.5,.18,.65,'#5d5d5d');plant.position.set(w*.22,h/2+.19,d*.22);building.add(plant);
 for(const side of[-1,1]){const windows=block(w*.7,.18,.035,'#383838');windows.position.set(0,h*.18,side*(d/2+.015));building.add(windows);}
 const door=block(.7,.65,.03,'#484848');door.position.set(w*.15,-h/2+.325,d/2+.02);building.add(door);
}
[[ -8,7,4,5,1.5],[-1,7,4.8,5,1.8],[6,7,4,5,1.3],[-8,16,4,5,1.1],[-1,16,4.8,5,1.5],[6,16,4,5,1.8],[13,9,3,4,2.5],[13,16,3,4,2.0]].forEach((v,i)=>addBuilding(...v,i));
// Native mesh instancing keeps groves inexpensive, with no external map or imagery provider.
const grovePoints=[];
for(let i=0;i<360;i++){const x=Math.sin(i*67.17)*47,z=Math.sin(i*31.71)*34;if((x>-18&&x<20&&z>-1&&z<24)||Math.abs(z-(-.45*x+2))<3.5)continue;const h=elevation(x,z);if(h<.5||h>7)continue;grovePoints.push({x,z,size:.6+((i*13)%17)/22});}
const grove=new THREE.InstancedMesh(new THREE.ConeGeometry(.45,1.7,5),new THREE.MeshLambertMaterial({color:'#2f2f2f'}),grovePoints.length);structures.add(grove);
const groveTransform=new THREE.Object3D();
function updateGroves(){grovePoints.forEach(({x,z,size},i)=>{groveTransform.position.set(x,elevation(x,z)+.85*size,z);groveTransform.scale.setScalar(size);groveTransform.updateMatrix();grove.setMatrixAt(i,groveTransform.matrix);});grove.instanceMatrix.needsUpdate=true;}updateGroves();
const roadPoints=[new THREE.Vector3(-32,0,19),new THREE.Vector3(-11,0,5),new THREE.Vector3(8,0,2),new THREE.Vector3(21,0,-10),new THREE.Vector3(36,0,-17)];
const roadCurve = new THREE.CatmullRomCurve3(roadPoints);
const roadGeo = new THREE.BufferGeometry();let roadVerts=[],roadIndices=[];
for(let i=0;i<=180;i++){const t=i/180,p=roadCurve.getPoint(t),dir=roadCurve.getTangent(t),n=new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(.55);for(const sign of [-1,1]){const x=p.x+n.x*sign,z=p.z+n.z*sign;roadVerts.push(x,elevation(x,z)+.06,z);}if(i<180){const a=i*2;roadIndices.push(a,a+1,a+2,a+1,a+3,a+2);}}
roadGeo.setAttribute('position',new THREE.Float32BufferAttribute(roadVerts,3));roadGeo.setIndex(roadIndices);roadGeo.computeVertexNormals();const road=new THREE.Mesh(roadGeo,new THREE.MeshStandardMaterial({color:'#535353',side:THREE.DoubleSide,roughness:1}));scene.add(road);
const roadDetails=[];
function roadStrip(points,width,color){const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z))),vs=[],ix=[];
 for(let i=0;i<=90;i++){const p=curve.getPoint(i/90),dir=curve.getTangent(i/90),n=new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(width/2);for(const sign of[-1,1]){const x=p.x+n.x*sign,z=p.z+n.z*sign;vs.push(x,elevation(x,z)+.09,z);}if(i<90){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vs,3));geo.setIndex(ix);geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));scene.add(mesh);roadDetails.push({mesh,geo});return curve;
}
roadStrip([[-16,9],[-12,12],[4,12],[16,12],[19,8]],.9,'#535353');
roadStrip([[-12,3],[-12,12],[-12,21],[10,21]],.8,'#4e4e4e');
roadStrip([[10,0],[10,12],[10,21]],.8,'#4e4e4e');
const laneGeometry=new THREE.BufferGeometry(),laneVerts=[];
for(let i=0;i<100;i+=2){for(const t of[i/100,(i+.8)/100]){const p=roadCurve.getPoint(t);laneVerts.push(p.x,elevation(p.x,p.z)+.1,p.z);}}
laneGeometry.setAttribute('position',new THREE.Float32BufferAttribute(laneVerts,3));const lanes=new THREE.LineSegments(laneGeometry,new THREE.LineBasicMaterial({color:'#d0d0d0',transparent:true,opacity:.7}));scene.add(lanes);

function toWorld(c){return new THREE.Vector3((c.x-380)/12,0,(c.y-220)/12);}
const objects = new Map();
for(const c of data.contacts){const g=new THREE.Group(),p=toWorld(c);g.position.set(p.x,elevation(p.x,p.z)+.15,p.z);g.userData.contact=c.id;
 const bus=c.cls==='Civilian';const body=block(bus?1.05:1.25,bus?1.05:.7,bus?3.3:2.1,bus?'#d5d5d5':'#7d7d7d');body.position.y=.7;g.add(body);
 const glass=block(bus?1.07:1.27,.38,bus?2.9:1.25,'#4a4a4a');glass.position.y=1;g.add(glass);
 const roof=block(bus?1.13:1.3,.18,bus?3.35:1.65,bus?'#e5e5e5':'#b3b3b3');roof.position.y=1.28;g.add(roof);
 for(const x of [-.63,.63])for(const z of [-.85,.85]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.18,12),new THREE.MeshStandardMaterial({color:'#383838'}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.28,z);g.add(wheel);}
 if(c.cls==='Hostile'){const turret=block(.7,.35,.8,'#aaaaaa');turret.position.y=1.55;g.add(turret);for(const x of [-.73,.73]){const track=block(.25,.5,2.4,'#3f3f3f');track.position.set(x,.34,0);g.add(track);}}
 if(c.cls==='Friendly'){g.clear();for(let i=0;i<4;i++){const person=new THREE.Group(),torso=block(.25,.5,.23,'#7b7b7b');torso.position.y=.65;person.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),new THREE.MeshStandardMaterial({color:'#c8c8c8'}));head.position.y=1.04;person.add(head);for(const x of [-.085,.085]){const leg=block(.1,.38,.12,'#4a4a4a');leg.position.set(x,.23,0);person.add(leg);}person.position.set((i%2)*.55,0,Math.floor(i/2)*.6);g.add(person);}}
 g.rotation.y=c.cls==='Civilian'?-.5:.35;contacts.add(g);objects.set(c.id,{g,c});
 const label=document.createElement('button');label.className='object-label';label.textContent=c.id;label.setAttribute('aria-label','Select '+c.id);label.dataset.object=c.id;label.onclick=()=>document.querySelector('[data-id="'+c.id+'"]').click();host.append(label);
}
const selection = new THREE.Mesh(new THREE.RingGeometry(2,2.055,64),new THREE.MeshBasicMaterial({color:'#dfdfdf',side:THREE.DoubleSide}));selection.rotation.x=-Math.PI/2;scene.add(selection);
const flight = new THREE.Group();const droneBody=block(.7,.3,1.1,'#eaeaea');flight.add(droneBody);
for(const x of [-.9,.9])for(const z of [-.9,.9]){const arm=block(1.3,.07,.09,'#4e4e4e');arm.rotation.y=x*z>0?-.75:.75;arm.position.set(x/2,0,z/2);flight.add(arm);const rotor=block(.75,.035,.1,'#f0f0f0');rotor.position.set(x,.18,z);rotor.userData.rotor=true;flight.add(rotor);}
// Moving aircraft does not invalidate the static terrain shadow map every frame.
flight.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});
scene.add(flight);
const flightCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-24,8,-10),new THREE.Vector3(13,8,-13),new THREE.Vector3(22,8,12),new THREE.Vector3(-20,8,16)],true);
function flightPoints(){return flightCurve.getPoints(200).map(p=>{p.y=elevation(p.x,p.z)+8;return p;});}
const flightLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(flightPoints()),new THREE.LineBasicMaterial({color:'#bebebe',transparent:true,opacity:.72}));routes.add(flightLine);
function setCamera(animate=false){dirty=true;const from=camera.position.clone(),fromQ=camera.quaternion.clone();cameraTransition=null;const radius=75;if(dimension==='2d')camera.position.set(target.x,80,target.z+.001);else camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,target.z+Math.cos(yaw)*Math.cos(pitch)*radius);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();if(animate&&!reduced.matches){cameraTransition={from,fromQ,to:camera.position.clone(),toQ:camera.quaternion.clone(),start:capture?time:performance.now()/1000};camera.position.copy(from);camera.quaternion.copy(fromQ);camera.updateMatrixWorld();}}
function select(id){dirty=true;selected=id;const o=objects.get(id);if(!o)return;selection.position.set(o.g.position.x,o.g.position.y-.1,o.g.position.z);host.querySelectorAll('.object-label').forEach(e=>{e.classList.toggle('selected',e.dataset.object===id);e.setAttribute('aria-pressed',String(e.dataset.object===id));});}
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);renderer.shadowMap.needsUpdate=true;const aspect=w/h;camera.left=-27*aspect;camera.right=27*aspect;camera.top=27;camera.bottom=-27;setCamera();}
new ResizeObserver(resize).observe(host);resize();select(selected);
for(const mode of ['2d','3d'])document.getElementById('view-'+mode).onclick=()=>{dimension=mode;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===mode)));setCamera(true);};
document.getElementById('layer-structures').onchange=e=>{structures.visible=e.target.checked;renderer.shadowMap.needsUpdate=true;};
document.getElementById('layer-routes').onchange=e=>routes.visible=e.target.checked;
document.getElementById('layer-terrain').onchange=e=>{terrain.visible=e.target.checked;topo.visible=e.target.checked;road.visible=e.target.checked;lanes.visible=e.target.checked;roadDetails.forEach(({mesh})=>mesh.visible=e.target.checked);};
document.getElementById('relief').oninput=e=>{relief=Number(e.target.value);updateTerrain();updateContours();updateGroves();roadDetails.forEach(({geo})=>{const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,elevation(p.getX(i),p.getZ(i))+.09);p.needsUpdate=true;geo.computeVertexNormals();});const lanePositions=laneGeometry.attributes.position;for(let i=0;i<lanePositions.count;i++)lanePositions.setY(i,elevation(lanePositions.getX(i),lanePositions.getZ(i))+.1);lanePositions.needsUpdate=true;flightLine.geometry.setFromPoints(flightPoints());for(const {building,x,z,h} of buildings)building.position.y=elevation(x,z)+h/2;for(const {g} of objects.values())g.position.y=elevation(g.position.x,g.position.z)+.15;const a=roadGeo.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,elevation(a.getX(i),a.getZ(i))+.06);a.needsUpdate=true;roadGeo.computeVertexNormals();select(selected);};
const motionButton=document.getElementById('scene-motion');function motionLabel(){motionButton.textContent=running?'Pause motion':'Play motion';motionButton.setAttribute('aria-pressed',String(running));}motionLabel();motionButton.onclick=()=>{running=!running;motionLabel();};reduced.addEventListener('change',()=>{running=!reduced.matches;motionLabel();});
document.getElementById('camera-reset').onclick=()=>{target.set(0,0,0);yaw=.65;pitch=.72;camera.zoom=1;setCamera();};
document.getElementById('zoom-in').onclick=()=>{camera.zoom=Math.min(3,camera.zoom*1.2);setCamera();};document.getElementById('zoom-out').onclick=()=>{camera.zoom=Math.max(.5,camera.zoom/1.2);setCamera();};
document.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.id)));
new MutationObserver(()=>{const id=document.querySelector('.row.sel')?.dataset.id;if(id&&id!==selected)select(id);}).observe(document.getElementById('list'),{subtree:true,attributes:true,attributeFilter:['class']});
document.addEventListener('input',()=>dirty=true);document.addEventListener('click',()=>dirty=true);
let px=0,py=0;const canvas=renderer.domElement;
canvas.onpointerdown=e=>{dragging=true;moved=false;px=e.clientX;py=e.clientY;canvas.setPointerCapture(e.pointerId);};
canvas.onpointermove=e=>{if(!dragging)return;const dx=e.clientX-px,dy=e.clientY-py;if(Math.abs(dx)+Math.abs(dy)>2)moved=true;if(dimension==='3d'){yaw-=dx*.008;pitch=THREE.MathUtils.clamp(pitch+dy*.006,.2,1.35);}else{target.x-=dx*.045/camera.zoom;target.z-=dy*.045/camera.zoom;}px=e.clientX;py=e.clientY;setCamera();};
canvas.onpointerup=e=>{dragging=false;if(moved)return;const r=canvas.getBoundingClientRect(),pointer=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects(contacts.children,true)[0];if(hit){let obj=hit.object;while(obj&&!obj.userData.contact)obj=obj.parent;if(obj)document.querySelector('[data-id="'+obj.userData.contact+'"]').click();}};
canvas.onpointercancel=()=>dragging=false;
canvas.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.altKey)return;e.preventDefault();camera.zoom=THREE.MathUtils.clamp(camera.zoom*Math.exp(-e.deltaY*.001),.5,3);setCamera();},{passive:false});
let visible=true;new IntersectionObserver(([e])=>visible=e.isIntersecting).observe(host);
const labelPositions=[...objects.values()].map(({g,c},i)=>{const leader=document.createElement('span');leader.className='object-leader';host.append(leader);return{g,el:host.querySelector('[data-object="'+c.id+'"]'),point:new THREE.Vector3(),leader,offset:[[-22,-30],[-20,-26],[22,10],[22,-25]][i]};});
const flightPoint=new THREE.Vector3(),ahead=new THREE.Vector3();
function draw(at){
 time=at;
 if(cameraTransition){const a=cameraTransition,p=Math.min(1,Math.max(0,((capture?at:performance.now()/1000)-a.start)/.65)),e=p*p*(3-2*p);camera.position.lerpVectors(a.from,a.to,e);camera.quaternion.slerpQuaternions(a.fromQ,a.toQ,e);camera.updateMatrixWorld();dirty=true;if(p>=1)cameraTransition=null;}
 const viewChanged=dirty;dirty=false;
 const t=(time/36)%1;
 flightCurve.getPoint(t,flightPoint);flight.position.copy(flightPoint);flight.position.y=elevation(flight.position.x,flight.position.z)+8;
 flightCurve.getPoint((t+.005)%1,ahead);ahead.y=elevation(ahead.x,ahead.z)+8;flight.lookAt(ahead);
 flight.children.forEach(c=>{if(c.userData.rotor)c.rotation.y=time*25;});
 // Contact labels only move when the camera, selection or terrain changes.
 if(viewChanged)for(const {g,el,point,leader,offset} of labelPositions){point.copy(g.position);point.y+=1.5;point.project(camera);const x=(point.x+1)/2*host.clientWidth,y=(-point.y+1)/2*host.clientHeight;el.style.left=(x+offset[0])+'px';el.style.top=(y+offset[1])+'px';el.hidden=point.z>1||point.x<-1||point.x>1||point.y<-1||point.y>1;leader.hidden=el.hidden;leader.style.left=x+'px';leader.style.top=y+'px';leader.style.width=Math.hypot(...offset)+'px';leader.style.transform='rotate('+Math.atan2(offset[1],offset[0])+'rad)';}

 renderer.render(scene,camera);
}
let previous=performance.now(),samples=0,elapsed=0;
function render(now){
 requestAnimationFrame(render);
 const dt=Math.min((now-previous)/1000,.1);previous=now;
 if(host.dataset.geography==='true'||!visible||document.hidden||(!running&&!dirty&&!cameraTransition)){samples=0;elapsed=0;return;}
 draw(time+(running?dt:0));
 // Reduce pixel work on slower devices instead of deliberately dropping frames.
 // Only sample uninterrupted motion, so idle time and first-load compilation do not lower quality.
 if(running&&!dragging){elapsed+=dt;samples++;if(elapsed>=1.5&&samples>=15){const avg=elapsed/samples;if(avg>.020&&renderScale>.5){renderScale=Math.max(.5,renderScale*.75);renderer.setPixelRatio(renderScale);resize();}samples=0;elapsed=0;}}
}
if(!capture)requestAnimationFrame(render);
window.LARKSPUR_SCENE={camera,scene,terrain,structures,routes,flight,get running(){return running;},get dimension(){return dimension;},get selected(){return selected;}};
if(capture)window.LARKSPUR_SCENE.renderFrame=draw;
}
