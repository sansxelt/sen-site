import subprocess,pathlib
# Rebuild the two homepage montage cuts with FFmpeg.
# Every source is a real photograph; see public/home/scenes/CREDITS.md.
r=pathlib.Path(__file__).resolve().parents[3]
work=pathlib.Path('/tmp/vraelis-systems-film');work.mkdir(exist_ok=True)
scenes=['public/site/photography/agent.jpg','public/site/photography/aiapp.jpg','public/home/orbit/photo-robot.jpg','public/site/photography/drone.jpg','public/home/scenes/military-robot.jpg','public/home/scenes/military-drone.jpg','public/home/scenes/helicopter.jpg','public/site/photography/agent.jpg']
for label,w,h in [('wide',1600,900),('vertical',720,1280)]:
 for i,p in enumerate(scenes):
  # Slow photographic movement; no fabricated screens or simulated aircraft movement.
  vf=f"scale={w*2}:{h*2}:force_original_aspect_ratio=increase,crop={w*2}:{h*2},zoompan=z='1.03+on*0.00045':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=90:s={w}x{h}:fps=30,setsar=1"
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(r/p),'-vf',vf,'-c:v','libx264','-threads','2','-preset','fast','-crf','22','-pix_fmt','yuv420p',str(work/f'{label}-{i}.mp4')],check=True)
  print(label,i,flush=True)
 inputs=[]
 for i in range(len(scenes)): inputs+=['-i',str(work/f'{label}-{i}.mp4')]
 filters=[];last='0:v'
 for i in range(1,len(scenes)):
  out=f'f{i}';filters.append(f'[{last}][{i}:v]xfade=transition=fade:duration=0.6:offset={i*2.4}[{out}]');last=out
 output=r/'public/home'/('systems-film.mp4' if label=='wide' else 'systems-film-vertical.mp4')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*inputs,'-filter_complex_threads','1','-filter_complex',';'.join(filters),'-map',f'[{last}]','-t','19.2','-c:v','libx264','-threads','2','-preset','fast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',str(output)],check=True)
 poster=r/'public/home'/('systems-poster.jpg' if label=='wide' else 'systems-poster-vertical.jpg')
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(output),'-frames:v','1','-q:v','3',str(poster)],check=True)
 print('Finished',label,output.stat().st_size,flush=True)
