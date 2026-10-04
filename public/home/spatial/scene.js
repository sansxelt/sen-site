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
const scene = new THREE.Scene(); scene.background = new THREE.Color('#c3c7c1');
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
let renderScale=Math.min(devicePixelRatio,1.25);
renderer.setPixelRatio(renderScale); renderer.shadowMap.enabled=true; renderer.shadowMap.autoUpdate=false; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label','Interactive terrain. Drag to rotate, scroll to zoom. Select contacts using the list.');
renderer.domElement.setAttribute('role','img'); host.prepend(renderer.domElement); host.dataset.ready='true';
const camera = new THREE.OrthographicCamera(-40,40,25,-25,.1,250);
const target = new THREE.Vector3(0,0,0); let yaw=.65, pitch=.72, dimension='3d', relief=1, running=!reduced.matches, dragging=false, moved=false, time=0, selected=document.querySelector('.row.sel')?.dataset.id || 'T-1', dirty=true;
scene.add(new THREE.HemisphereLight('#ffffff','#686c5c',2.6));
const sun = new THREE.DirectionalLight('#fff7e8',3.1); sun.position.set(-30,55,20); sun.castShadow=true; sun.shadow.mapSize.set(512,512); sun.shadow.camera.left=-50;sun.shadow.camera.right=50;sun.shadow.camera.top=45;sun.shadow.camera.bottom=-45;sun.shadow.normalBias=.2;scene.add(sun);
function elevation(x,z) { return (5.8*Math.exp(-((x+18)**2+(z+12)**2)/120)+8.5*Math.exp(-((x-24)**2+(z-6)**2)/160)+.2*Math.sin(x*.24)*Math.cos(z*.2))*relief; }
const terrainGeometry = new THREE.PlaneGeometry(76,52,90,65); terrainGeometry.rotateX(-Math.PI/2);
const terrain = new THREE.Mesh(terrainGeometry,new THREE.MeshStandardMaterial({color:'#8d9787',roughness:1,flatShading:true}));terrain.receiveShadow=true;scene.add(terrain);
function updateTerrain() {renderer.shadowMap.needsUpdate=true;const a=terrainGeometry.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,elevation(a.getX(i),a.getZ(i)));a.needsUpdate=true;terrainGeometry.computeVertexNormals();}
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
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));topo.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:'#596657',transparent:true,opacity:.24})));
}
updateContours();
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(76,.25,52)),new THREE.LineBasicMaterial({color:'#9ca497'}));edges.position.y=-.3;scene.add(edges);
const structures = new THREE.Group(), routes = new THREE.Group(), contacts = new THREE.Group();scene.add(structures,routes,contacts);
function block(w,h,d,color) {const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.86}));m.castShadow=true;m.receiveShadow=true;return m;}
const buildings=[];
for(let i=0;i<24;i++){const x=-8+(i%6)*3.25,z=5+Math.floor(i/6)*3.5,h=.8+((i*7)%9)*.17;const building=block(2.05,h,2.2,'#dad9d0');building.position.set(x,elevation(x,z)+h/2,z);structures.add(building);const outline=new THREE.LineSegments(new THREE.EdgesGeometry(building.geometry),new THREE.LineBasicMaterial({color:'#8c9287',transparent:true,opacity:.4}));building.add(outline);buildings.push({building,x,z,h});const roof=block(2.15,.12,2.3,'#b8b7aa');roof.position.y=h/2;building.add(roof);}
const roadPoints=[new THREE.Vector3(-32,0,19),new THREE.Vector3(-11,0,5),new THREE.Vector3(8,0,2),new THREE.Vector3(21,0,-10),new THREE.Vector3(36,0,-17)];
const roadCurve = new THREE.CatmullRomCurve3(roadPoints);
const roadGeo = new THREE.BufferGeometry();let roadVerts=[],roadIndices=[];
for(let i=0;i<=180;i++){const t=i/180,p=roadCurve.getPoint(t),dir=roadCurve.getTangent(t),n=new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(.55);for(const sign of [-1,1]){const x=p.x+n.x*sign,z=p.z+n.z*sign;roadVerts.push(x,elevation(x,z)+.06,z);}if(i<180){const a=i*2;roadIndices.push(a,a+1,a+2,a+1,a+3,a+2);}}
roadGeo.setAttribute('position',new THREE.Float32BufferAttribute(roadVerts,3));roadGeo.setIndex(roadIndices);roadGeo.computeVertexNormals();const road=new THREE.Mesh(roadGeo,new THREE.MeshStandardMaterial({color:'#e1ded0',side:THREE.DoubleSide,roughness:1}));scene.add(road);
function toWorld(c){return new THREE.Vector3((c.x-380)/12,0,(c.y-220)/12);}
const objects = new Map();
for(const c of data.contacts){const g=new THREE.Group(),p=toWorld(c);g.position.set(p.x,elevation(p.x,p.z)+.15,p.z);g.userData.contact=c.id;
 const bus=c.cls==='Civilian';const body=block(bus?1.05:1.25,bus?1.05:.7,bus?3.3:2.1,bus?'#e3d4b3':'#778072');body.position.y=.7;g.add(body);
 const glass=block(bus?1.07:1.27,.38,bus?2.9:1.25,'#414d4c');glass.position.y=1;g.add(glass);
 const roof=block(bus?1.13:1.3,.18,bus?3.35:1.65,bus?'#eee4ce':'#aeb5a7');roof.position.y=1.28;g.add(roof);
 for(const x of [-.63,.63])for(const z of [-.85,.85]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.26,.26,.18,12),new THREE.MeshStandardMaterial({color:'#343a35'}));wheel.rotation.z=Math.PI/2;wheel.position.set(x,.28,z);g.add(wheel);}
 if(c.cls==='Hostile'){const turret=block(.7,.35,.8,'#a3ad9b');turret.position.y=1.55;g.add(turret);for(const x of [-.73,.73]){const track=block(.25,.5,2.4,'#394239');track.position.set(x,.34,0);g.add(track);}}
 if(c.cls==='Friendly'){g.clear();for(let i=0;i<4;i++){const person=new THREE.Group(),torso=block(.25,.5,.23,'#707f6e');torso.position.y=.65;person.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),new THREE.MeshStandardMaterial({color:'#d3c7ac'}));head.position.y=1.04;person.add(head);for(const x of [-.085,.085]){const leg=block(.1,.38,.12,'#414e40');leg.position.set(x,.23,0);person.add(leg);}person.position.set((i%2)*.55,0,Math.floor(i/2)*.6);g.add(person);}}
 g.rotation.y=c.cls==='Civilian'?-.5:.35;contacts.add(g);objects.set(c.id,{g,c});
 const label=document.createElement('button');label.className='object-label';label.textContent=c.id;label.setAttribute('aria-label','Select '+c.id);label.dataset.object=c.id;label.onclick=()=>document.querySelector('[data-id="'+c.id+'"]').click();host.append(label);
}
const selection = new THREE.Mesh(new THREE.RingGeometry(2,2.07,64),new THREE.MeshBasicMaterial({color:'#514e3e',side:THREE.DoubleSide}));selection.rotation.x=-Math.PI/2;scene.add(selection);
const flight = new THREE.Group();const droneBody=block(.7,.3,1.1,'#eeeae0');flight.add(droneBody);
for(const x of [-.9,.9])for(const z of [-.9,.9]){const arm=block(1.3,.07,.09,'#46514b');arm.rotation.y=x*z>0?-.75:.75;arm.position.set(x/2,0,z/2);flight.add(arm);const rotor=block(.75,.035,.1,'#f3f0e7');rotor.position.set(x,.18,z);rotor.userData.rotor=true;flight.add(rotor);}
// Moving aircraft does not invalidate the static terrain shadow map every frame.
flight.traverse(o=>{o.castShadow=false;o.receiveShadow=false;});
scene.add(flight);
const flightCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-24,8,-10),new THREE.Vector3(13,8,-13),new THREE.Vector3(22,8,12),new THREE.Vector3(-20,8,16)],true);
function flightPoints(){return flightCurve.getPoints(200).map(p=>{p.y=elevation(p.x,p.z)+8;return p;});}
const flightLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(flightPoints()),new THREE.LineBasicMaterial({color:'#78867e',transparent:true,opacity:.7}));routes.add(flightLine);
function setCamera(){dirty=true;const radius=75;if(dimension==='2d')camera.position.set(target.x,80,target.z+.001);else camera.position.set(target.x+Math.sin(yaw)*Math.cos(pitch)*radius,Math.sin(pitch)*radius,target.z+Math.cos(yaw)*Math.cos(pitch)*radius);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
function select(id){dirty=true;selected=id;const o=objects.get(id);if(!o)return;selection.position.set(o.g.position.x,o.g.position.y-.1,o.g.position.z);host.querySelectorAll('.object-label').forEach(e=>{e.classList.toggle('selected',e.dataset.object===id);e.setAttribute('aria-pressed',String(e.dataset.object===id));});}
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);renderer.shadowMap.needsUpdate=true;const aspect=w/h;camera.left=-27*aspect;camera.right=27*aspect;camera.top=27;camera.bottom=-27;setCamera();}
new ResizeObserver(resize).observe(host);resize();select(selected);
for(const mode of ['2d','3d'])document.getElementById('view-'+mode).onclick=()=>{dimension=mode;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===mode)));setCamera();};
document.getElementById('layer-structures').onchange=e=>{structures.visible=e.target.checked;renderer.shadowMap.needsUpdate=true;};
document.getElementById('layer-routes').onchange=e=>routes.visible=e.target.checked;
document.getElementById('layer-terrain').onchange=e=>{terrain.visible=e.target.checked;topo.visible=e.target.checked;road.visible=e.target.checked;edges.visible=e.target.checked;};
document.getElementById('relief').oninput=e=>{relief=Number(e.target.value);updateTerrain();updateContours();flightLine.geometry.setFromPoints(flightPoints());for(const {building,x,z,h} of buildings)building.position.y=elevation(x,z)+h/2;for(const {g} of objects.values())g.position.y=elevation(g.position.x,g.position.z)+.15;const a=roadGeo.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,elevation(a.getX(i),a.getZ(i))+.06);a.needsUpdate=true;roadGeo.computeVertexNormals();select(selected);};
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
const labelPositions=[...objects.values()].map(({g,c})=>({g,el:host.querySelector('[data-object="'+c.id+'"]'),point:new THREE.Vector3()}));
const flightPoint=new THREE.Vector3(),ahead=new THREE.Vector3();
function draw(at){
 time=at;
 const viewChanged=dirty;dirty=false;
 const t=(time/36)%1;
 flightCurve.getPoint(t,flightPoint);flight.position.copy(flightPoint);flight.position.y=elevation(flight.position.x,flight.position.z)+8;
 flightCurve.getPoint((t+.005)%1,ahead);ahead.y=elevation(ahead.x,ahead.z)+8;flight.lookAt(ahead);
 flight.children.forEach(c=>{if(c.userData.rotor)c.rotation.y=time*25;});
 // Contact labels only move when the camera, selection or terrain changes.
 if(viewChanged)for(const {g,el,point} of labelPositions){point.copy(g.position);point.y+=2.8;point.project(camera);el.style.left=((point.x+1)/2*host.clientWidth)+'px';el.style.top=((-point.y+1)/2*host.clientHeight)+'px';el.hidden=point.z>1||point.x<-1||point.x>1||point.y<-1||point.y>1;}
 renderer.render(scene,camera);
}
let previous=performance.now(),samples=0,elapsed=0;
function render(now){
 requestAnimationFrame(render);
 const dt=Math.min((now-previous)/1000,.1);previous=now;
 if(!visible||document.hidden||(!running&&!dirty)){samples=0;elapsed=0;return;}
 draw(time+(running?dt:0));
 // Reduce pixel work on slower devices instead of deliberately dropping frames.
 // Only sample uninterrupted motion, so idle time and first-load compilation do not lower quality.
 if(running&&!dragging){elapsed+=dt;samples++;if(elapsed>=1.5&&samples>=15){const avg=elapsed/samples;if(avg>.020&&renderScale>.5){renderScale=Math.max(.5,renderScale*.75);renderer.setPixelRatio(renderScale);resize();}samples=0;elapsed=0;}}
}
if(!capture)requestAnimationFrame(render);
window.LARKSPUR_SCENE={camera,scene,terrain,structures,routes,flight,get running(){return running;},get dimension(){return dimension;},get selected(){return selected;}};
if(capture)window.LARKSPUR_SCENE.renderFrame=draw;
}
