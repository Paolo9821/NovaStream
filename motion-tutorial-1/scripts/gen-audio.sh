#!/usr/bin/env bash
# Generates the narration, music and effects for all four NovaStream films (Tutorial 1 & 2, Short 1 & 2).
# Same female English voice as the walkthrough film. Run from the project root:
#   bash motion-tutorial-1/scripts/gen-audio.sh <outDir>
# Each clip lands in <outDir>/<app>/<id>.mp3, then is levelled into public/ with scripts/download-audio.mjs --file.
set -u
OUT=${1:?outDir}
VOICE=XrExE9yKIg1WjnnlVkGX

say() { # app id text
  mkdir -p "$OUT/$1"
  (rork ai audio speak "$3" --voice $VOICE --voice-model elevenlabs -o "$OUT/$1/$2.mp3"; echo "exit $?") > "$OUT/$1/$2.log" 2>&1 &
}
music() { # app id seconds prompt
  mkdir -p "$OUT/$1"
  (rork ai audio music "$4" -d "$3" --instrumental -o "$OUT/$1/$2.mp3"; echo "exit $?") > "$OUT/$1/$2.log" 2>&1 &
}
sfx() { # app id seconds prompt
  mkdir -p "$OUT/$1"
  (rork ai audio sfx "$4" -d "$3" -o "$OUT/$1/$2.mp3"; echo "exit $?") > "$OUT/$1/$2.log" 2>&1 &
}

T1=motion-tutorial-1
say $T1 hook "[warmly] Seven NovaStream features most people never find. Stick around for tip five: it can rescue a playlist that just won't load."
say $T1 autoplay "Tip one: never reach for the remote between episodes. In Settings, open Player and turn on autoplay. NovaStream jumps to the next episode during the closing credits, and you choose how many seconds before the end it switches."
say $T1 reconnect "Tip two: when a live stream drops, just wait. The player reconnects on its own. And right from the player, you can jump to the previous or next channel, or skip ten seconds back and forward."
say $T1 tracks "Tip three: during a film, open the picture menu. You can switch the audio language, turn subtitles on or off, and choose how the picture fits your screen."
say $T1 parental "Tip four: the parental lock. Choose the categories you want to protect, set a PIN, and they stay locked until someone types it in. Perfect for the family TV in the living room."
say $T1 dns "Tip five: custom DNS. If a playlist loads slowly, or not at all, the culprit is often your network's DNS. In Settings, open DNS, enter your own server or a DNS over HTTPS address, and test it right there."
say $T1 speed "Tip six: the built-in speed test. In a few seconds it measures your bandwidth, so you know which quality your connection can really handle. Then tune the buffer: longer to ride out a shaky connection, shorter to start channels faster."
say $T1 auto "Tip seven: let the list update itself. Under Automatic list update, choose once a day or once a week, and keep the TV guide refreshing too. Channels, films and guide stay fresh, without lifting a finger."
say $T1 bonus "And a bonus: make it yours. Pick a light or dark theme, or follow your system, and switch between eight interface languages whenever you like."
say $T1 recap "Quick recap: autoplay, auto reconnect, audio and subtitles, parental lock, custom DNS, speed test, and automatic updates."
say $T1 outro "[warmly] NovaStream is on Google Play. Add your own playlist and try these tonight. And subscribe, so you don't miss the next tip."
music $T1 music 240 "Upbeat modern electronic tech tutorial bed, crisp plucked synths, light punchy drums, optimistic and clean, steady energy, no vocals"
sfx $T1 tick 1.2 "Soft rounded UI tick, a felt mallet tapping a small wooden block, close and dry, gentle body"
sfx $T1 whoosh 1.5 "Soft airy whoosh passing by, smooth fabric swish, close and dry, full body, gentle"
sfx $T1 logo 2.5 "Warm cinematic logo hit, soft low boom with a glassy shimmer tail, gentle"

T2=motion-tutorial-2
say $T2 hook "[warmly] M3U, Xtream codes, EPG. If those words sound like a foreign language, give me three minutes, and you'll know exactly how to watch your own playlist on any screen."
say $T2 player "First, the most important part. NovaStream is a player. It comes with no channels of its own. What you watch comes from a playlist you get from your own provider, and you should only use playlists you're allowed to watch."
say $T2 m3u "So, what's an M3U playlist? It's simply a text file, or a link to one. Each entry holds a channel name, its logo, its group, and the address of the stream. The app reads the list and turns it into a proper TV menu."
say $T2 xtream "Xtream codes is another way to sign in. Instead of one long link, your provider gives you three things: a server address, a username, and a password. With those, the app loads live TV, movies and series separately, with posters, plots and seasons."
say $T2 which "Which one should you pick? If your provider offers Xtream codes, use them: movies and series come neatly organised. If all you have is a link, M3U works perfectly too."
say $T2 epg "And EPG? It stands for electronic programme guide: the TV guide that shows what's on now, and what's next. It usually comes as an XMLTV file. With Xtream codes, NovaStream finds it automatically. With M3U, paste the guide link in its own field."
say $T2 devices "Where can you watch? On Android TV, on TV boxes and sticks, and on Android phones and tablets. The layout adapts to every screen."
say $T2 setup "Setting up takes about a minute. Open Accounts, choose M3U URL, Xtream codes, or private host, fill in the fields, and import. Your details are encrypted, and stay on the device."
say $T2 phone "Hate typing long links with a remote? Open novastreamapp.com slash playlist on your phone or computer, enter the device and the key shown on your TV, and send the playlist over."
say $T2 fix1 "Now, the three most common problems. Playlist won't load? Open the link in a browser to make sure it works, and check that your subscription with the provider is still active."
say $T2 fix2 "Empty TV guide? Make sure there's a guide link, then open TV guide in Settings and update it. Some providers only publish a few days of programmes."
say $T2 fix3 "Buffering? Run the speed test, give the player a longer buffer, and if the server is slow to answer, try a custom DNS."
say $T2 outro "[warmly] That's it: you now speak fluent playlist. Get NovaStream on Google Play, and subscribe for more guides like this one."
music $T2 music 245 "Calm warm lo-fi explainer bed, soft electric piano chords, mellow brushed beat, gentle bass, friendly and focused, no vocals"
sfx $T2 pop 1.2 "Soft bubbly pop, a cork gently leaving a small glass bottle, close and dry, rounded body"
sfx $T2 whoosh 1.5 "Soft airy whoosh passing by, smooth paper swish, close and dry, full body, gentle"

S1=motion-short-1
say $S1 hook "[excited] Stop. Turn your phone sideways."
say $S1 new "NovaStream now works in landscape, on phones and on tablets."
say $S1 wide "Live TV, the guide, your films and series: everything spreads across the full width of the screen."
say $S1 tablet "And on a tablet, it feels like a TV in your hands."
say $S1 cta "[warmly] Update NovaStream on Google Play, and turn it sideways."
music $S1 music 45 "Energetic punchy synth pop bed for a short social video, bright arpeggios, driving kick, confident and fun, no vocals"
sfx $S1 rotate 1.5 "Smooth mechanical swivel, a phone sliding and rotating on a soft surface, close and dry, full body"
sfx $S1 hit 1.5 "Punchy warm bass hit with a short bright shimmer, gentle attack"

S2=motion-short-2
say $S2 pov "[amused] POV: typing a sixty character playlist link with your TV remote."
say $S2 pain "[sighs] One wrong letter, and you start all over again."
say $S2 fix "Here's the trick. On your phone, open novastreamapp.com slash playlist."
say $S2 key "Type the device, and the six character key shown on your TV."
say $S2 done "Paste your link, send it, and the playlist lands on your TV. No remote typing. Ever again."
say $S2 cta "[warmly] NovaStream. Follow for more TV tricks."
music $S2 music 45 "Playful quirky pizzicato and muted synth beat that turns into a bright confident pop groove, short social video, no vocals"
sfx $S2 click 1.0 "Soft plastic TV remote button click, close and dry, rounded body"
sfx $S2 ding 1.5 "Bright friendly success ding, a small glass bell softly struck, warm tail"
wait
