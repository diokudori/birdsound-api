import os
import numpy as np
from scipy.io import wavfile

SAMPLE_RATE = 22050
DURATION = 3.0  # seconds per sample

def generate_robin_call(variant=1):
    """American Robin: Melodic frequency sweeps (2000 Hz - 4000 Hz) with rhythmic chirps."""
    t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)
    signal = np.zeros_like(t)
    
    # 4 distinct chirp phrases
    phrases = 4 + variant
    phrase_dur = DURATION / phrases
    for i in range(phrases):
        start_idx = int(i * phrase_dur * SAMPLE_RATE)
        end_idx = int((i + 0.6) * phrase_dur * SAMPLE_RATE)
        t_phrase = t[start_idx:end_idx] - t[start_idx]
        
        # Frequency sweep from 2200Hz to 3800Hz
        freq = 2200 + 1600 * np.sin(2 * np.pi * (3 + variant) * t_phrase)
        env = np.sin(np.pi * np.linspace(0, 1, len(t_phrase))) ** 2
        signal[start_idx:end_idx] += env * np.sin(2 * np.pi * freq * t_phrase)
        # Add 2nd harmonic
        signal[start_idx:end_idx] += 0.3 * env * np.sin(4 * np.pi * freq * t_phrase)
        
    return signal / (np.max(np.abs(signal)) + 1e-6)

def generate_sparrow_call(variant=1):
    """House Sparrow: Short rapid high-pitched cheeps (3500 Hz - 5500 Hz)."""
    t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)
    signal = np.zeros_like(t)
    
    cheeps = 8 + variant * 2
    cheep_dur = 0.08  # 80ms
    interval = DURATION / cheeps
    
    for i in range(cheeps):
        start_time = i * interval
        start_idx = int(start_time * SAMPLE_RATE)
        end_idx = min(start_idx + int(cheep_dur * SAMPLE_RATE), len(t))
        t_cheep = t[start_idx:end_idx] - start_time
        
        # Rapid upward pitch sweep 3500 -> 5500 Hz
        freq = 3500 + 2000 * (t_cheep / cheep_dur)
        env = np.sin(np.pi * np.linspace(0, 1, len(t_cheep)))
        signal[start_idx:end_idx] += env * np.sin(2 * np.pi * freq * t_cheep)
        
    return signal / (np.max(np.abs(signal)) + 1e-6)

def generate_nightingale_call(variant=1):
    """Nightingale: Pure flute-like whistles and rapid trills (1500 Hz - 6000 Hz)."""
    t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)
    signal = np.zeros_like(t)
    
    # Whistle phase
    whistle_len = int(1.2 * SAMPLE_RATE)
    t_w = t[:whistle_len]
    freq_w = 4000 + 1000 * np.sin(2 * np.pi * (1.5 + variant * 0.5) * t_w)
    env_w = np.sin(np.pi * np.linspace(0, 1, whistle_len))
    signal[:whistle_len] += env_w * np.sin(2 * np.pi * freq_w * t_w)
    
    # Rapid trill phase
    trill_start = whistle_len + int(0.2 * SAMPLE_RATE)
    trill_len = int(1.4 * SAMPLE_RATE)
    t_tr = t[trill_start:trill_start + trill_len] - t[trill_start]
    freq_tr = 3000 + 2500 * np.sign(np.sin(2 * np.pi * (15 + variant * 2) * t_tr))
    env_tr = np.sin(np.pi * np.linspace(0, 1, trill_len))
    signal[trill_start:trill_start + trill_len] += env_tr * np.sin(2 * np.pi * freq_tr * t_tr)
    
    return signal / (np.max(np.abs(signal)) + 1e-6)

def generate_blue_jay_call(variant=1):
    """Blue Jay: Harsh call sweeps (1200 Hz - 2800 Hz) with strong harmonics."""
    t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)
    signal = np.zeros_like(t)
    
    calls = 3
    call_dur = 0.5
    for i in range(calls):
        start_idx = int((i * 0.9 + 0.1) * SAMPLE_RATE)
        end_idx = start_idx + int(call_dur * SAMPLE_RATE)
        if end_idx > len(t):
            break
        t_call = t[start_idx:end_idx] - t[start_idx]
        
        freq = 1200 + 1600 * (1 - t_call / call_dur)
        env = np.sin(np.pi * np.linspace(0, 1, len(t_call)))
        # Multi-harmonic complex tone
        tone = (np.sin(2 * np.pi * freq * t_call) + 
                0.6 * np.sin(4 * np.pi * freq * t_call) + 
                0.4 * np.sin(6 * np.pi * freq * t_call))
        signal[start_idx:end_idx] += env * tone
        
    return signal / (np.max(np.abs(signal)) + 1e-6)

def generate_barn_owl_call(variant=1):
    """Barn Owl: Hissing screech noise band (4000 Hz - 8000 Hz)."""
    t = np.linspace(0, DURATION, int(SAMPLE_RATE * DURATION), endpoint=False)
    signal = np.zeros_like(t)
    
    # White noise filtered / modulated
    noise = np.random.normal(0, 1, len(t))
    # Simple bandpass modulation using high frequency carrier
    carrier = np.sin(2 * np.pi * (5500 + variant * 300) * t)
    screech = noise * carrier
    
    # 2 screech bursts
    for i in range(2):
        start_idx = int((i * 1.4 + 0.2) * SAMPLE_RATE)
        dur = int(1.0 * SAMPLE_RATE)
        end_idx = min(start_idx + dur, len(t))
        env = np.sin(np.pi * np.linspace(0, 1, end_idx - start_idx)) ** 2
        signal[start_idx:end_idx] += env * screech[start_idx:end_idx]
        
    return signal / (np.max(np.abs(signal)) + 1e-6)

SPECIES_GENERATORS = {
    "American_Robin": generate_robin_call,
    "House_Sparrow": generate_sparrow_call,
    "Nightingale": generate_nightingale_call,
    "Blue_Jay": generate_blue_jay_call,
    "Barn_Owl": generate_barn_owl_call,
}

def generate_all_samples(base_dir="./data/train"):
    """Generates synthetic audio files for training."""
    print("Generating synthetic bioacoustic dataset...")
    total_files = 0
    for species, generator in SPECIES_GENERATORS.items():
        species_dir = os.path.join(base_dir, species)
        os.makedirs(species_dir, exist_ok=True)
        for v in range(1, 4):
            audio = generator(variant=v)
            # Scale to 16-bit integer WAV PCM
            audio_int16 = (audio * 32767).astype(np.int16)
            file_path = os.path.join(species_dir, f"sample_{v}.wav")
            wavfile.write(file_path, SAMPLE_RATE, audio_int16)
            total_files += 1
            print(f"  [+] Generated {file_path}")
            
    print(f"Successfully generated {total_files} samples across {len(SPECIES_GENERATORS)} species in '{base_dir}'.")

if __name__ == "__main__":
    generate_all_samples()
