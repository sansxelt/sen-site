"""Civilian systems film: an original edit of Pexels-licensed footage, no military material.

Same treatment as compose.py (cover-crop, 60 fps, light grade, hard cuts, no sound),
landscape only because the v8 homepage tile is the one place it plays.
"""
import os, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[2]
source = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/vraelis-footage-civil')
ffmpeg = os.environ.get('FFMPEG', 'ffmpeg')
temp = source / 'edit'
temp.mkdir(exist_ok=True)
# name (Pexels id), in-point, duration
shots = [
    ('robot-line', 5.5, 3.5), # 32386532 robot arm on a production line
    ('agv-floor', 0.3, 4),    # 32386627 factory floor with mobile robots
    ('substation', 2, 4),     # 10416553 drone view of a power substation
    ('drone', 0.5, 3),        # 4446375 civilian quadcopter in flight
    ('solar', 1, 3),          # 7042814 drone view of a solar farm
    ('robot', 3, 4),          # 16938947 warehouse robot arm stacking pallets
    ('code', 1, 3),           # 5473798 software on screen
]
w, h = 1600, 900
for i, (name, start, duration) in enumerate(shots):
    src = source / f'{name}.mp4'
    scale = f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}:(iw-ow)/2:(ih-oh)/2'
    filt = f'{scale},setsar=1,fps=60,eq=saturation=0.86:contrast=1.025:brightness=-0.01,format=yuv420p'
    subprocess.run([ffmpeg, '-y', '-v', 'error', '-ss', str(start), '-i', str(src), '-map', '0:v:0', '-map_metadata', '-1', '-t', str(duration), '-vf', filt, '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '26', str(temp / f'wide-{i}.mp4')], check=True)
concat = temp / 'wide.txt'
concat.write_text(''.join(f"file '{(temp / f'wide-{i}.mp4').as_posix()}'\n" for i in range(len(shots))))
out = root / 'public/home/systems-film-civil.mp4'
subprocess.run([ffmpeg, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat), '-map', '0:v:0', '-map_metadata', '-1', '-c', 'copy', '-movflags', '+faststart', str(out)], check=True)
subprocess.run([ffmpeg, '-y', '-v', 'error', '-ss', '0.8', '-i', str(out), '-frames:v', '1', '-q:v', '2', str(root / 'public/home/systems-poster-civil.jpg')], check=True)
print('wide', out.stat().st_size, flush=True)
