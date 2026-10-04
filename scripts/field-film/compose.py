"""Original edit of licensed photography and public-domain training footage."""
import pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parents[2]
source = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/vraelis-footage')
temp = source / 'edit'
temp.mkdir(exist_ok=True)
# name, source extension, in-point, duration, portrait framing
shots = [
    ('robot', 'mp4', 3, 5, '(iw-ow)*0.22'),
    ('code', 'mp4', 1, 3, '(iw-ow)/2'),
    ('quadruped', 'webm', 55, 5, '(iw-ow)*0.35'),
    ('mq9', 'webm', 5, 5, '(iw-ow)*(0.60-0.035*t)'),
    ('apache', 'webm', 7, 4, '(iw-ow)*0.47'),
    ('product', 'mp4', 7, 5, '(iw-ow)/2'),
]
for label, w, h in [('wide', 1600, 900), ('vertical', 720, 1280)]:
    for i, (name, ext, start, duration, portrait_x) in enumerate(shots):
        src = root / ('public/home/spatial-check-vertical.mp4' if label == 'vertical' else 'public/home/spatial-check.mp4') if name == 'product' else source / f'{name}.{ext}'
        x = portrait_x if label == 'vertical' else '(iw-ow)/2'
        # Preserve the complete portrait product screen; live-action crops keep the subject in frame.
        scale = f'scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=0x070a0d' if name == 'product' else f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}:{x}:(ih-oh)/2'
        filt = f'{scale},setsar=1,fps=30,eq=saturation=0.86:contrast=1.025:brightness=-0.01,format=yuv420p'
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(start), '-i', str(src), '-t', str(duration), '-vf', filt, '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '24', str(temp / f'{label}-{i}.mp4')], check=True)
    concat = temp / f'{label}.txt'
    concat.write_text(''.join(f"file '{temp / f'{label}-{i}.mp4'}'\n" for i in range(len(shots))))
    suffix = '-vertical' if label == 'vertical' else ''
    out = root / f'public/home/systems-film-spatial{suffix}.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', str(concat), '-c', 'copy', '-movflags', '+faststart', str(out)], check=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', '0', '-i', str(out), '-frames:v', '1', '-q:v', '2', str(root / f'public/home/systems-poster-spatial{suffix}.jpg')], check=True)
    print(label, out.stat().st_size, flush=True)
