import json, math, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

SR=48000; DUR=60.0; N=int(SR*DUR); OUT=Path('video/assets/audio'); OUT.mkdir(parents=True,exist_ok=True)
rng=np.random.default_rng(24092026)

def write(name,x):
    x=np.asarray(x,float); peak=float(np.max(np.abs(x)))
    if peak>.98: x=x*(.98/peak)
    pcm=(x*32767).astype('<i2')
    with wave.open(str(OUT/name),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    return {'seconds':len(x)/SR,'peak_dbfs':20*math.log10(max(1e-9,float(np.max(np.abs(x))))),'rms_dbfs':20*math.log10(max(1e-9,float(np.sqrt(np.mean(x*x)))))}

def stereo(sig,pan=0):
    a=(pan+1)*math.pi/4
    return np.column_stack((sig*math.cos(a),sig*math.sin(a)))

def pluck(freq,dur=.75,amp=.15,pan=0,bright=1):
    n=int(SR*dur); t=np.arange(n)/SR
    attack=np.minimum(1,t/.006); env=attack*np.exp(-t*(4.2-1.1*bright))
    phase=rng.random(4)*2*math.pi
    sig=(np.sin(2*np.pi*freq*t+phase[0])+.42*np.sin(2*np.pi*2*freq*t+phase[1])+.2*np.sin(2*np.pi*3*freq*t+phase[2])+.08*np.sin(2*np.pi*5*freq*t+phase[3]))
    sig*=env/(1+.42+.2+.08); sig+=rng.normal(0,.035,n)*np.exp(-t*35)
    return stereo(sig*amp,pan)

def kick(amp=.12):
    dur=.28;n=int(SR*dur);t=np.arange(n)/SR;phase=2*np.pi*(72*t-32*t*t)
    return stereo((np.sin(phase)*np.exp(-t*16)+rng.normal(0,.04,n)*np.exp(-t*55))*amp,0)

def shaker(amp=.035,pan=0):
    n=int(SR*.09);t=np.arange(n)/SR;noise=rng.normal(0,1,n);sos=butter(2,4500,btype='highpass',fs=SR,output='sos')
    return stereo(sosfilt(sos,noise)*np.exp(-t*38)*amp,pan)

def click():
    n=int(SR*.14);t=np.arange(n)/SR
    wood=(np.sin(2*np.pi*780*t)+.5*np.sin(2*np.pi*1160*t))*np.exp(-t*52)
    tick=rng.normal(0,1,n)*np.exp(-t*95)
    sig=(wood*.35+tick*.12)*.72
    return stereo(sig,-.08)

def whoosh():
    n=int(SR*.72);t=np.arange(n)/SR;noise=rng.normal(0,1,n);sos=butter(3,[650,6200],btype='bandpass',fs=SR,output='sos');sig=sosfilt(sos,noise)
    env=np.sin(np.pi*np.clip(t/.72,0,1))**1.7
    out=np.zeros((n,2)); out[:,0]=sig*env*(1-t/.72)*.12;out[:,1]=sig*env*(t/.72)*.12
    return out

def confirm():
    n=int(SR*.62);out=np.zeros((n,2))
    for delay,freq,pan in [(0,659,-.18),(.11,880,.18),(.22,1047,0)]:
        x=pluck(freq,.38,.24,pan,1.15);i=int(delay*SR);out[i:i+len(x)]+=x[:n-i]
    return out

def add(dst,src,sec,gain=1):
    i=int(sec*SR);j=min(len(dst),i+len(src));
    if j>i:dst[i:j]+=src[:j-i]*gain

# Original evolving plucked bed, 100 BPM, twenty-five bars.
music=np.zeros((N,2)); beat=.6
chords=[(60,64,67),(55,59,62),(57,60,64),(53,57,60),(60,64,67),(52,55,59),(53,57,60),(55,59,62),
        (57,60,64),(53,57,60),(60,64,67),(55,59,62),(50,53,57),(55,59,62),(60,64,67),(57,60,64),
        (53,57,60),(55,59,62),(52,55,59),(57,60,64),(53,57,60),(55,59,62),(60,64,67),(57,60,64),(60,64,67)]
for bar,ch in enumerate(chords):
    start=bar*4*beat
    dynamic=.72+.12*math.sin(bar*.7)+(0.08 if 8<=bar<20 else 0)
    for b in range(4):
        note=ch[(b*2+bar)%3]-12 if b in (0,2) else ch[(b+bar)%3]
        add(music,pluck(440*2**((note-69)/12),.58,.115*dynamic,-.28+.18*b),start+b*beat)
        upper=ch[(b+1)%3]+12
        add(music,pluck(440*2**((upper-69)/12),.34,.065*dynamic,.32-.15*b),start+b*beat+.3)
        if b in (0,2):add(music,kick(.085*dynamic),start+b*beat)
        add(music,shaker(.025*dynamic,(-1)**b*.35),start+b*beat+.3)
    # Phrase endings vary every two bars.
    if bar%2==1:
        phrase=[ch[1]+12,ch[2]+12,ch[1]+14,ch[0]+12] if bar%4==1 else [ch[2]+12,ch[1]+12,ch[0]+12,ch[1]+12]
        for k,note in enumerate(phrase):add(music,pluck(440*2**((note-69)/12),.42,.055,.15,1.1),start+1.8+k*.15)

# Broad musical dynamics and true fade.
t=np.arange(N)/SR;shape=np.ones(N);shape*=np.clip((t-.4)/1.4,0,1);shape*=np.clip((60-t)/2.4,0,1)
shape*=1-.10*np.exp(-((t-31)/4.2)**2)+.08*np.exp(-((t-49)/4.5)**2)
music*=shape[:,None]

click_s=click();whoosh_s=whoosh();confirm_s=confirm();mix=music*.74
for sec in [9.2,12,13.4,25.4,30.8,32.2,36.6,37.2,48.2,50.4,51.7,57.4]:add(mix,click_s,sec,.85 if sec!=32.2 else .55)
for sec in [10.0,18.5,28.7,35.0,41.0,54.0]:add(mix,whoosh_s,sec,.75)
for sec in [4.2,39.0,49.0]:add(mix,confirm_s,sec,.68 if sec==4.2 else .9)
for sec in np.arange(44.0,47.01,.22):add(mix,click_s,float(sec),.19)

# Prevent clipping while retaining action transients.
peak=np.max(np.abs(mix));mix*=.84/max(peak,1e-9)
levels={}
music_asset=music*.74;music_asset*=.32/max(np.max(np.abs(music_asset)),1e-9)
levels['music.wav']=write('music.wav',music_asset)
levels['click.wav']=write('click.wav',click_s)
levels['whoosh.wav']=write('whoosh.wav',whoosh_s)
levels['confirm.wav']=write('confirm.wav',confirm_s)
levels['mix.wav']=write('mix.wav',mix)
Path('.checks/audio-levels.json').write_text(json.dumps(levels,indent=2),encoding='utf-8')
print(json.dumps(levels,indent=2))
