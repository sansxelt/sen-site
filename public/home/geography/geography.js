// Real geography is deliberately separate from the fictional mission contacts.
const host = document.getElementById('spatial-scene');
const container = document.getElementById('geography-map');
const source = document.getElementById('map-source');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const origin = [-119.579, 37.745]; // Yosemite Valley, a public landscape reference.
let map, loading, dimension = '3d', simulationDimension = '3d';
const status = document.createElement('div');
status.className = 'geography-status'; status.setAttribute('role', 'status');
container.append(status);
const style = {
 version:8,
 glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
 sources:{
  earth:{type:'vector',url:'https://tiles.openfreemap.org/planet',attribution:'<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>'},
  elevation:{type:'raster-dem',tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],tileSize:256,maxzoom:15,encoding:'terrarium',attribution:'<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">Elevation: Tilezen, USGS and contributors</a>'}
 },
 layers:[
  {id:'background',type:'background',paint:{'background-color':'#282828'}},
  {id:'land',type:'fill',source:'earth','source-layer':'landcover',paint:{'fill-color':'#333333','fill-opacity':0.7}},
  {id:'parks',type:'fill',source:'earth','source-layer':'park',paint:{'fill-color':'#363636','fill-opacity':0.4}},
  {id:'shade',type:'hillshade',source:'elevation',paint:{'hillshade-shadow-color':'#080808','hillshade-highlight-color':'#999999','hillshade-accent-color':'#555555','hillshade-exaggeration':0.45}},
  {id:'water',type:'fill',source:'earth','source-layer':'water',paint:{'fill-color':'#171717'}},
  {id:'rivers',type:'line',source:'earth','source-layer':'waterway',paint:{'line-color':'#aaaaaa','line-width':1}},
  {id:'roads-edge',type:'line',source:'earth','source-layer':'transportation',paint:{'line-color':'#151515','line-width':['interpolate',['linear'],['zoom'],8,1,16,8]}},
  {id:'roads',type:'line',source:'earth','source-layer':'transportation',paint:{'line-color':'#cccccc','line-width':['interpolate',['linear'],['zoom'],8,0.5,16,3]}},
  {id:'buildings',type:'fill-extrusion',source:'earth','source-layer':'building',minzoom:13,paint:{'fill-extrusion-color':'#bbbbbb','fill-extrusion-height':['coalesce',['get','render_height'],5],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':0.9}},
  {id:'places',type:'symbol',source:'earth','source-layer':'place',layout:{'text-field':['coalesce',['get','name:en'],['get','name']],'text-font':['Noto Sans Regular'],'text-size':12,'text-max-width':8},paint:{'text-color':'#eeeeee','text-halo-color':'#222222','text-halo-width':1.5}},
  {id:'peaks',type:'symbol',source:'earth','source-layer':'mountain_peak',layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':11},paint:{'text-color':'#dddddd','text-halo-color':'#222222','text-halo-width':1}}
 ]
};
async function initialize() {
 if (map) return map;
 if (loading) return loading;
 loading = (async () => {
  status.textContent = 'Loading geography';
  const css = document.createElement('link');css.rel='stylesheet';css.href='/home/geography/maplibre-gl.css';document.head.append(css);
  await new Promise((resolve,reject) => {const script=document.createElement('script');script.src='/home/geography/maplibre-gl.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
  map = new window.maplibregl.Map({container,style,center:origin,zoom:12.5,pitch:dimension==='3d'?60:0,bearing:-25,maxPitch:75,attributionControl:{compact:false},pixelRatio:Math.min(devicePixelRatio,1.25)});
  container.append(status);
  map.on('load', () => {map.setTerrain(dimension==='3d'?{source:'elevation',exaggeration:1.15}:null);status.textContent='';container.dataset.loaded='true';});
  map.on('error', () => {status.textContent='Some map data could not load. Return to Simulation or try Geography again.';});
  map.on('idle', () => {if(map.areTilesLoaded()) status.textContent='';});
  new ResizeObserver(() => {if(!container.hidden)map.resize();}).observe(container);
  window.LARKSPUR_GEOGRAPHY = map;
  return map;
 })().catch(() => {status.textContent='Geography unavailable. Simulation is still available.'; loading=null;});
 return loading;
}
source.addEventListener('change', async () => {
 const active=source.value==='geography';
 if(active)simulationDimension=document.getElementById('view-2d').getAttribute('aria-pressed')==='true'?'2d':'3d';
 host.dataset.geography=String(active);container.hidden=!active;
 document.body.classList.toggle('geography-active',active);
 document.querySelector('.sim').textContent=active?'Geography reference':'Simulation';
 for(const v of ['2d','3d'])document.getElementById('view-'+v).setAttribute('aria-pressed',String(v===(active?dimension:simulationDimension)));
 document.getElementById('m-h').textContent=active?'Yosemite Valley':'North Ridge';
 for(const el of document.querySelectorAll('.layers,#scene-motion'))el.hidden=active;
 if(active){await initialize();map?.resize();}
});
for(const value of ['2d','3d']) document.getElementById('view-'+value).addEventListener('click', event => {
 if(source.value!=='geography')return;
 event.stopImmediatePropagation();dimension=value;
 for(const v of ['2d','3d'])document.getElementById('view-'+v).setAttribute('aria-pressed',String(v===value));
 if(!map?.isStyleLoaded())return;
 map.setTerrain(value==='3d'?{source:'elevation',exaggeration:1.15}:null);
 map.easeTo({pitch:value==='3d'?60:0,bearing:value==='3d'?-25:0,duration:reduced.matches?0:650});
},true);
for(const id of ['camera-reset','zoom-in','zoom-out'])document.getElementById(id).addEventListener('click',event=>{
 if(source.value!=='geography')return;
 event.stopImmediatePropagation();if(!map)return;
 const duration=reduced.matches?0:350;
 if(id==='camera-reset')map.easeTo({center:origin,zoom:12.5,pitch:dimension==='3d'?60:0,bearing:dimension==='3d'?-25:0,duration});
 else if(id==='zoom-in')map.zoomIn({duration});else map.zoomOut({duration});
},true);
