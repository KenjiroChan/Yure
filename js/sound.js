
let audioCtx=null;
let soundOn=false;

const notes = [
  146.8, 155.6, 196.0, 220.0, 233.1,
  293.7, 311.1, 392.0, 440.0, 466.2,
  587.3, 622.3, 784.0, 880.0, 932.3
];

function startSound() {
    if (audioCtx==null) {
        audioCtx=new AudioContext();
    }
    audioCtx.resume();
    soundOn=true;
}

function stopSound() {
    soundOn=false;
}

function playTone(frequency, volume, length, panner){
    let now = audioCtx.currentTime;
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();

    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);

    osc.connect(gain);
    gain.connect(panner);
    osc.start(now);
    osc.stop(now+length);
}

function playQuake(quake, listenerLon){
    if(!soundOn) return;

    /* basically the deeper the quake, the lower the note */
    let depth = Math.min(Math.max(quake.depth, 0), 700);
    let freq = notes[Math.round((1-depth/700)*(notes.length-1))];

    /* the bigger the quake, the louder and longer the note */
    let mag = Math.max(quake.mag, 0);
    let volume = Math.min(0.05 + mag*.06,0.45);
    let length= 0.3 + mag * 0.6;

    /* how far east/west of Toronto the quake is */
    let diff = quake.lon - listenerLon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    /* handles speaker sides */
    let panner = audioCtx.createStereoPanner();
    panner.pan.value=diff/180;
    panner.connect(audioCtx.destination);
    playTone(freq, volume, length, panner);

    if (mag>=4.5){
        playTone(freq/2, volume*0.8, length*1.5, panner);
    }
}