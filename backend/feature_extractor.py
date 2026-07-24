import io
import numpy as np
import librosa
import soundfile as sf
from typing import Union

DEFAULT_SAMPLE_RATE = 22050

def extract_features(audio_source: Union[str, bytes, io.BytesIO], sr: int = DEFAULT_SAMPLE_RATE) -> np.ndarray:
    """
    Extract bioacoustic feature vector from audio file path, raw bytes, or BytesIO stream.
    
    Features extracted (44 dimensions):
    - 20 MFCC Means
    - 20 MFCC Standard Deviations
    - Spectral Centroid Mean & Standard Deviation
    - Spectral Rolloff Mean
    - Zero Crossing Rate Mean
    """
    y = None
    sample_rate = sr

    # Try librosa.load first
    try:
        if isinstance(audio_source, bytes):
            audio_source = io.BytesIO(audio_source)
        y, sample_rate = librosa.load(audio_source, sr=sr)
    except Exception:
        # Fallback for complex MP3 headers or byte stream issues
        try:
            if isinstance(audio_source, (bytes, io.BytesIO)):
                if isinstance(audio_source, bytes):
                    audio_source = io.BytesIO(audio_source)
                audio_source.seek(0)
                y, sample_rate = sf.read(audio_source)
            elif isinstance(audio_source, str):
                y, sample_rate = sf.read(audio_source)

            if y is not None:
                if y.ndim > 1:
                    y = np.mean(y, axis=1)
                if sample_rate != sr:
                    y = librosa.resample(y, orig_sr=sample_rate, target_sr=sr)
        except Exception as fallback_err:
            raise ValueError(f"Could not decode audio file: {str(fallback_err)}")

    if y is None or len(y) == 0:
        raise ValueError("Audio stream is empty or unreadable.")

    # 1. 20 MFCCs (Mean & Std Dev)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    mfcc_mean = np.mean(mfcc, axis=1)
    mfcc_std = np.std(mfcc, axis=1)

    # 2. Spectral Centroid (Mean & Std Dev)
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
    cent_mean = np.array([np.mean(centroid)])
    cent_std = np.array([np.std(centroid)])

    # 3. Spectral Rolloff (Mean)
    rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
    rolloff_mean = np.array([np.mean(rolloff)])

    # 4. Zero Crossing Rate (Mean)
    zcr = librosa.feature.zero_crossing_rate(y=y)
    zcr_mean = np.array([np.mean(zcr)])

    # Concatenate into 44-element numpy vector
    feature_vector = np.hstack([
        mfcc_mean,
        mfcc_std,
        cent_mean,
        cent_std,
        rolloff_mean,
        zcr_mean
    ])

    return feature_vector
