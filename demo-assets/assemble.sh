#!/bin/bash
# Final demo video (11 scenes, 96.5s) — landing → app → themes → realm unlock.
set -e
cd /Users/saichaitu/Desktop/edu/demo-assets
A=$(pwd)
SRC=$A/footage/norm.mp4
OUT=$A/build
mkdir -p "$OUT"
FF=/opt/homebrew/bin/ffmpeg

# Durations: s1 card 9.0 | s2 5.2 | s3 9.0 | s4 8.1 | s5 15.9 | s6 8.8 | s7 8.5 | s8 13.6 | s9 7.7 | s10 6.7 | s11 card 11.0
# Footage:   s2 [0,5.2] | s3 [5.2,14.2] | s4 [14.2,22.3] | s5 [22.3,38.2] | s6 [38.2,47.0] | s7 [47.0,55.5] | s8 [55.5,69.1] | s9 [69.1,76.8] | s10 [76.8,83.5]

VF_BASE="scale=1920:1200:flags=lanczos,crop=1920:1080:0:60,fps=30,format=yuv420p"

scene () { # <out> <ss> <dur> <capPng or "-">
  local out=$1 ss=$2 dur=$3 cap=$4
  if [ "$cap" = "-" ]; then
    $FF -y -loglevel error -ss "$ss" -t "$dur" -i "$SRC" -vf "$VF_BASE" -an "$OUT/$out.mp4"
  else
    $FF -y -loglevel error -ss "$ss" -t "$dur" -i "$SRC" -loop 1 -t "$dur" -i "$cap" -filter_complex \
      "[0:v]$VF_BASE[base];[1:v]scale=1920:130,fade=t=in:st=0.5:d=0.4:alpha=1,fade=t=out:st=$(python3 -c "print($dur-0.7)"):d=0.4:alpha=1[cap];[base][cap]overlay=0:920[v]" \
      -map "[v]" -an "$OUT/$out.mp4"
  fi
}
echo "== scenes =="
scene s2 0    5.2  "-"
scene s3 5.2  9.0  cap-s2.png
scene s4 14.2 8.1  cap-studio.png
scene s5 22.3 15.9 cap-s3.png
scene s6 38.2 8.8  cap-s4.png
scene s7 47.0 8.5  cap-s5.png
scene s8 55.5 13.6 "-"
scene s9 69.1 7.7  cap-studio.png
scene s10 76.8 6.7 cap-s6.png

echo "== cards =="
$FF -y -loglevel error -loop 1 -t 9.0  -i card-title.png -vf "fps=30,format=yuv420p,fade=t=in:st=0:d=0.4" -an "$OUT/s1.mp4"
$FF -y -loglevel error -loop 1 -t 11.0 -i card-end.png   -vf "fps=30,format=yuv420p,fade=t=out:st=10.6:d=0.4" -an "$OUT/s11.mp4"

echo "== xfade =="
$FF -y -loglevel error \
 -i "$OUT/s1.mp4" -i "$OUT/s2.mp4" -i "$OUT/s3.mp4" -i "$OUT/s4.mp4" -i "$OUT/s5.mp4" -i "$OUT/s6.mp4" -i "$OUT/s7.mp4" -i "$OUT/s8.mp4" -i "$OUT/s9.mp4" -i "$OUT/s10.mp4" -i "$OUT/s11.mp4" \
 -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.7:offset=8.3[v1];[v1][2:v]xfade=transition=fade:duration=0.7:offset=12.8[v2];[v2][3:v]xfade=transition=fade:duration=0.7:offset=21.1[v3];[v3][4:v]xfade=transition=fade:duration=0.7:offset=28.5[v4];[v4][5:v]xfade=transition=fade:duration=0.7:offset=43.7[v5];[v5][6:v]xfade=transition=fade:duration=0.7:offset=51.8[v6];[v6][7:v]xfade=transition=fade:duration=0.7:offset=59.6[v7];[v7][8:v]xfade=transition=fade:duration=0.7:offset=72.5[v8];[v8][9:v]xfade=transition=fade:duration=0.7:offset=79.5[v9];[v9][10:v]xfade=transition=fade:duration=0.7:offset=85.5[vout]" \
 -map "[vout]" -r 30 -c:v libx264 -crf 19 -preset medium -pix_fmt yuv420p "$OUT/video_silent.mp4"

echo "== narration + sfx =="
SFX=~/Desktop/video-studio/audio-library/sfx
$FF -y -loglevel error \
 -i narration/n1.mp3 -i narration/nL.mp3 -i narration/n2.mp3 -i narration/n6.mp3 -i narration/s3.mp3 -i narration/s4.mp3 -i narration/s5v3.mp3 -i narration/s6b.mp3 -i narration/n8.mp3 -i narration/n9.mp3 \
 -i $SFX/whoosh.wav -i $SFX/pop.wav -i $SFX/pop.wav -i $SFX/chime.wav -i $SFX/pop.wav -i $SFX/pop.wav -i $SFX/pop.wav -i $SFX/pop.wav -i $SFX/whoosh.wav \
 -filter_complex "[0:a]adelay=0:all=1[a0];[1:a]adelay=8500:all=1[a1];[2:a]adelay=13000:all=1[a2];[3:a]adelay=21300:all=1[a3];[4:a]adelay=28700:all=1[a4];[5:a]adelay=43900:all=1[a5];[6:a]adelay=52100:all=1[a6];[7:a]adelay=59800:all=1[a7];[8:a]adelay=73600:all=1[a8];[9:a]adelay=85800:all=1[a9];\
[10:a]adelay=8300:all=1,volume=0.5[x1];[11:a]adelay=11100:all=1,volume=0.45[x2];[12:a]adelay=24900:all=1,volume=0.45[x3];[13:a]adelay=68600:all=1,volume=0.55[x4];[14:a]adelay=74040:all=1,volume=0.45[x5];[15:a]adelay=75590:all=1,volume=0.45[x6];[16:a]adelay=77140:all=1,volume=0.45[x7];[17:a]adelay=78690:all=1,volume=0.45[x8];[18:a]adelay=79500:all=1,volume=0.4[x9];\
[a0][a1][a2][a3][a4][a5][a6][a7][a8][a9][x1][x2][x3][x4][x5][x6][x7][x8][x9]amix=inputs=19:normalize=0,highpass=f=70,acompressor=threshold=-21dB:ratio=2.5:attack=8:release=120:makeup=4,loudnorm=I=-16:TP=-1.5:LRA=9,aformat=channel_layouts=stereo,apad,atrim=0:96.5,afade=t=out:st=94.9:d=1.6[narr]" \
 -map "[narr]" -ar 48000 "$OUT/narration.wav"

echo "== mux =="
$FF -y -loglevel error -i "$OUT/video_silent.mp4" -i "$OUT/narration.wav" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT/Abhyas_Demo_nomusic.mp4"

echo "== music =="
$FF -y -loglevel error -stream_loop -1 -i ~/Desktop/video-studio/audio-library/music/synth-lofi-beat.wav -t 97.5 -c:a pcm_s16le "$OUT/music_loop.wav"
bash ~/Desktop/video-studio/scripts/add-music.sh "$OUT/Abhyas_Demo_nomusic.mp4" "$OUT/music_loop.wav" "$A/Abhyas_Demo.mp4"

echo "== done =="
ffprobe -v quiet -show_entries format=duration -of csv=p=0 "$A/Abhyas_Demo.mp4"
