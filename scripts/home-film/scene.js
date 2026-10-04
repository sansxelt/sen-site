// Original Vraelis motion film. Screens are unmodified captures of our own demo apps.
// Geometry is an illustration of software inspection, not hardware control or recorded flight.
import * as THREE from './three.module.min.js';
import { encodeMp4, sliceBase64 } from './encode.js';
const portrait=new URLSearchParams(location.search).has('portrait');
const W=portrait?720:1600,H=portrait?1280:900,FPS=30,DURATION=24;
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.setClearColor('#070a0d');renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#070a0d',.023);
const camera=new THREE.PerspectiveCamera(portrait?48:39,W/H,.1,180);
scene.add(new THREE.HemisphereLight('#c0d1de','#17130d',2.0));
const key=new THREE.DirectionalLight('#e0edf7',5);key.position.set(-6,7,8);scene.add(key);
const rim=new THREE.DirectionalLight('#a4d2e7',4);rim.position.set(4,1,-5);scene.add(rim);
const warm=new THREE.PointLight('#dd9f68',40,18);warm.position.set(-3,-2,5);scene.add(warm);
let seed=7181;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),ease=x=>x*x*(3-2*x);
const beat=(t,c,r)=>{const d=Math.min(Math.abs(t-c),DURATION-Math.abs(t-c));return d<r?ease((1+Math.cos(d/r*Math.PI))/2):0;};
const white='#b8ccd5',amber='#d8a36d';
const lineMat=(color=white,opacity=.25)=>new THREE.LineBasicMaterial({color,transparent:true,opacity});
function curve(points,color=white,opacity=.25){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),lineMat(color,opacity));}
function circle(r,color=white,opacity=.3){const pts=[];for(let i=0;i<=180;i++)pts.push(new THREE.Vector3(Math.cos(i/180*TAU)*r,Math.sin(i/180*TAU)*r,0));return curve(pts,color,opacity);}
function setOpacity(group,opacity){group.visible=opacity>.003;group.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.transparent=true;m.opacity=(m.userData.original??=m.opacity)*opacity;}}});}
const cosmos=new THREE.Group();scene.add(cosmos);const stars=[];
for(let i=0;i<950;i++)stars.push((rand()-.5)*80,(rand()-.5)*50,-rand()*42-8);
const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(stars,3));
cosmos.add(new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#8da1ad',size:.025,transparent:true,opacity:.45,sizeAttenuation:true})));
const globe=new THREE.Group();scene.add(globe);globe.position.set(portrait?-6.5:-10,-6.5,-10);
const sphere=new THREE.Mesh(new THREE.SphereGeometry(8,64,48),new THREE.MeshStandardMaterial({color:'#0b1720',roughness:.8,metalness:.4}));globe.add(sphere);
const shell=new THREE.Mesh(new THREE.SphereGeometry(8.018,48,32),new THREE.MeshBasicMaterial({color:'#53727b',wireframe:true,transparent:true,opacity:.12}));globe.add(shell);
const globeDots=[];for(let i=0;i<1100;i++){const a=rand()*TAU,b=Math.acos(rand()*2-1);globeDots.push(8.045*Math.sin(b)*Math.cos(a),8.045*Math.cos(b),8.045*Math.sin(b)*Math.sin(a));}
const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(globeDots,3));globe.add(new THREE.Points(dg,new THREE.PointsMaterial({size:.035,color:'#97b4ba',transparent:true,opacity:.55})));
const orbitPaths=new THREE.Group();scene.add(orbitPaths);
for(let i=0;i<4;i++){const c=circle(9+i*.8,i===0?amber:white,.07+i*.022);c.rotation.x=.7+i*.12;c.rotation.y=.25+i*.25;c.position.set(-3,-3,-5);orbitPaths.add(c);}
const tracers=[];for(let j=0;j<5;j++){const m=new THREE.Mesh(new THREE.SphereGeometry(.045,12,8),new THREE.MeshBasicMaterial({color:j===0?amber:'#bedee8'}));scene.add(m);tracers.push(m);}
const textureLoader=new THREE.TextureLoader();
async function screen(url,width){const tex=await textureLoader.loadAsync(url);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
 const group=new THREE.Group(),height=width*tex.image.height/tex.image.width;
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));group.add(plane);
 const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width+.06,height+.06,.09)),lineMat('#a6c5d0',.4));group.add(edge);
 const back=new THREE.Mesh(new THREE.BoxGeometry(width+.09,height+.09,.12),new THREE.MeshStandardMaterial({color:'#11191e',metalness:.7,roughness:.35}));back.position.z=-.08;group.add(back);
 return group;
}
const app=await screen('./mission-before.png',portrait?6.2:10.8),mission=await screen('./mission-before.png',portrait?6.2:11.7);
const afterTexture=await textureLoader.loadAsync('./mission-after.png');afterTexture.colorSpace=THREE.SRGBColorSpace;afterTexture.anisotropy=8;
scene.add(app,mission);
const drone=new THREE.Group();scene.add(drone);
const graphite=new THREE.MeshStandardMaterial({color:'#353e43',metalness:.65,roughness:.27});
const graphiteDark=new THREE.MeshStandardMaterial({color:'#11191d',metalness:.55,roughness:.38});
const satin=new THREE.MeshStandardMaterial({color:'#718087',metalness:.72,roughness:.22});
function mesh(geometry,material,x,y,z,parent=drone){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
const body=mesh(new THREE.CapsuleGeometry(.4,.9,10,24),graphite,0,0,0);body.rotation.x=Math.PI/2;body.scale.set(1,.9,.5);
mesh(new THREE.BoxGeometry(.65,.13,.95),graphiteDark,0,.17,0);
for(let i=0;i<12;i++)mesh(new THREE.BoxGeometry(.44,.015,.015),satin,0,.242,-.34+i*.058);
const rotors=[];
for(const x of [-1,1])for(const z of [-1,1]){
 const end=new THREE.Vector3(x*1.45,.05,z*1.05),start=new THREE.Vector3(x*.24,.02,z*.24),length=end.distanceTo(start);
 const arm=mesh(new THREE.CylinderGeometry(.075,.11,length,12),graphiteDark,...start.clone().add(end).multiplyScalar(.5).toArray());arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());
 mesh(new THREE.CylinderGeometry(.17,.19,.28,24),graphite,...end.toArray());
 const rotor=new THREE.Group();rotor.position.copy(end).add(new THREE.Vector3(0,.17,0));drone.add(rotor);
 mesh(new THREE.SphereGeometry(.08,16,8),satin,0,.015,0,rotor);
 for(const angle of [0,Math.PI]){const blade=mesh(new THREE.BoxGeometry(.72,.016,.065),graphite,.33*Math.cos(angle),0,.33*Math.sin(angle),rotor);blade.rotation.y=-angle+.12;}
 rotors.push(rotor);
 const landing=mesh(new THREE.CylinderGeometry(.025,.025,.4,10),satin,end.x,-.31,end.z);landing.rotation.z=-x*.22;
 const disk=mesh(new THREE.RingGeometry(.53,.57,64),new THREE.MeshBasicMaterial({color:'#8298a0',transparent:true,opacity:.08,side:THREE.DoubleSide}),end.x,end.y+.17,end.z);disk.rotation.x=-Math.PI/2;
}
const sensor=mesh(new THREE.SphereGeometry(.13,20,12),graphiteDark,0,-.22,.5);sensor.scale.set(1,1,.8);
mesh(new THREE.CircleGeometry(.065,24),new THREE.MeshBasicMaterial({color:'#88b9cd'}),0,-.22,.607);
mesh(new THREE.BoxGeometry(.07,.025,.03),new THREE.MeshBasicMaterial({color:amber}),0,.27,.2);
const inspection=new THREE.Group();scene.add(inspection);
for(let i=0;i<3;i++){const ring=circle(2.3+i*.23,i===1?amber:white,i===1?.32:.12);ring.rotation.x=Math.PI/2-i*.2;inspection.add(ring);}
const scan=new THREE.Mesh(new THREE.PlaneGeometry(5.7,4.3),new THREE.MeshBasicMaterial({color:'#89afc3',transparent:true,opacity:.045,side:THREE.DoubleSide}));scan.rotation.y=Math.PI/2;inspection.add(scan);
const terrain=new THREE.Group();scene.add(terrain);terrain.position.set(0,-5,-5);
const geo=new THREE.PlaneGeometry(28,22,75,60);const p=geo.attributes.position;
for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,Math.sin(x*.7)*Math.cos(y*.45)*.65+Math.sin(x*.31+y*.35)*.4);}
geo.computeVertexNormals();const terr=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'#52727e',wireframe:true,transparent:true,opacity:.13}));terr.rotation.x=-Math.PI/2;terrain.add(terr);
// Deliberately leave the upper portion quiet for the page's one-line headline.
function draw(t){t=((t%DURATION)+DURATION)%DURATION;const phase=t/DURATION*TAU;
 const apps=beat(t,1,7),air=beat(t,9,7),ops=beat(t,17,8);
 camera.position.set(Math.sin(phase)*1.35,portrait?3.4:2.4+Math.sin(phase)*.45,portrait?19+Math.cos(phase)*.8:17.2+Math.cos(phase)*1.2);camera.lookAt(0,portrait?.7:.6,0);
 cosmos.rotation.y=Math.sin(phase)*.016;globe.rotation.z=.08*Math.sin(phase);globe.rotation.y=.3*Math.sin(phase);orbitPaths.rotation.z=Math.sin(phase)*.08;
 setOpacity(app,apps);app.position.set(portrait?0:-1.7,-.6+apps*.15,1.3);app.rotation.y=portrait?-.07:-.18+Math.sin(phase)*.06;app.rotation.z=-.025;
 setOpacity(drone,air);drone.position.set(portrait?0:1.3,-1.0+Math.sin(phase*2)*.3,2.3);drone.rotation.set(.24+.06*Math.sin(phase),-.55+.65*Math.sin(phase),.02*Math.cos(phase));drone.scale.setScalar(portrait?1.45:1.75);
 for(let i=0;i<rotors.length;i++)rotors[i].rotation.y=t*TAU*8+(i%2)*Math.PI; // integer turns per loop
 setOpacity(inspection,air);inspection.position.copy(drone.position);inspection.rotation.y=phase;scan.position.x=Math.sin(phase)*2.1;
 mission.children[0].material.map=t>=16.4&&t<21.5?afterTexture:app.children[0].material.map;setOpacity(mission,ops);mission.position.set(portrait?0:1.2,portrait?-.9:-.65,portrait?2.4:1.3);mission.rotation.y=portrait?-.02:-.10+.045*Math.sin(phase);mission.rotation.x=.025*Math.sin(phase);
 terrain.rotation.y=.07*Math.sin(phase);setOpacity(terrain,.3+.7*ops);
 for(let i=0;i<tracers.length;i++){const a=phase+i*TAU/5;tracers[i].position.set(-3+Math.cos(a)*(9+i*.4),-3+Math.sin(a)*3.4,-5+Math.sin(a)*3);}
 renderer.render(scene,camera);
}
let output=null;
window.__film={width:W,height:H,length:DURATION,fps:FPS,renderAt:draw,poster(t=0){draw(t);return renderer.domElement.toDataURL('image/jpeg',.94);},async record(){output=(await encodeMp4({width:W,height:H,fps:FPS,frames:FPS*DURATION,bitrate:portrait?2500000:5200000,draw(i,ctx){draw(i/FPS);ctx.drawImage(renderer.domElement,0,0);}})).bytes;return output.length;},slice(i){return sliceBase64(output,i);}};
draw(0);window.__ready=true;
