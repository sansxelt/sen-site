"""Original edit of licensed real footage. Rebuild from sources listed in SOURCES.md."""
import pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]
source=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/vraelis-footage')
temp=source/'edit';temp.mkdir(exist_ok=True)
shots=[('code',1),('circuit',4),('robot',3),('controller',3),('flight',2),('catch',2)]
for label,w,h in [('wide',1600,900),('vertical',720,960)]:
 for i,(name,start) in enumerate(shots):
  # Centered crops reviewed separately in both orientations. No fake interface overlays.
  x='(iw-ow)*0.40' if name=='robot' else '(iw-ow)/2'
  filt=f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}:{x}:(ih-oh)/2,setsar=1,fps=30,eq=saturation=0.86:contrast=1.025:brightness=-0.01,format=yuv420p'
  subprocess.run(['ffmpeg','-y','-v','error','-ss',str(start),'-i',str(source/(name+'.mp4')),'-t','4','-vf',filt,'-an','-c:v','libx264','-threads','2','-preset','fast','-crf','24',str(temp/f'{label}-{i}.mp4')],check=True)
 concat=temp/f'{label}.txt';concat.write_text(''.join(f"file '{temp / f'{label}-{i}.mp4'}'\n" for i in range(len(shots))))
 suffix='-vertical' if label=='vertical' else ''
 out=root/f'public/home/field-film{suffix}.mp4'
 subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(concat),'-c','copy','-movflags','+faststart',str(out)],check=True)
 subprocess.run(['ffmpeg','-y','-v','error','-ss','0','-i',str(out),'-frames:v','1','-q:v','2',str(root/f'public/home/field-poster{suffix}.jpg')],check=True)
 print(label,out.stat().st_size,flush=True)
