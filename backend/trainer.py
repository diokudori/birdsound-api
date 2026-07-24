import os
import glob
import re
import datetime
import joblib
import numpy as np
from sklearn.preprocessing import StandardScaler
from backend.feature_extractor import extract_features

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "bird_classifier.joblib")
DATA_DIR = os.path.join(BASE_DIR, "data", "train")
SUPPORTED_EXTENSIONS = ("*.wav", "*.mp3", "*.ogg", "*.flac")

def train_model(data_dir: str = DATA_DIR, model_path: str = MODEL_PATH) -> dict:
    """
    Scans dataset directory recursively for bird categories & species subdirectories,
    extracts bioacoustic features, fits a StandardScaler, computes species prototype centroids,
    and persists the model artifact to joblib.
    """
    if not os.path.exists(data_dir):
        os.makedirs(data_dir, exist_ok=True)
        raise ValueError(f"Dataset directory '{data_dir}' was missing and has been created.")

    X_raw = []
    labels = []
    species_sample_counts = {}
    species_metadata = {}

    print(f"[+] Scanning dataset recursively in '{data_dir}'...")

    for root, dirs, files in os.walk(data_dir):
        audio_files = []
        for ext in SUPPORTED_EXTENSIONS:
            audio_files.extend(glob.glob(os.path.join(root, ext)))
            audio_files.extend(glob.glob(os.path.join(root, ext.upper())))
        
        audio_files = list(set(audio_files))
        if not audio_files:
            continue

        rel_path = os.path.relpath(root, data_dir)
        parts = rel_path.split(os.sep)

        if len(parts) == 1:
            category = "General"
            raw_species = parts[0]
        else:
            category = parts[0]
            raw_species = parts[-1]

        # Clean numerical prefixes like "1. ", "10. "
        clean_species = re.sub(r'^\d+\.\s*', '', raw_species).strip()
        label_id = f"{category} | {clean_species}" if len(parts) > 1 else clean_species

        species_metadata[label_id] = {
            "category": category,
            "species": clean_species,
            "raw_folder": raw_species,
            "rel_path": rel_path
        }

        count = 0
        for audio_file in audio_files:
            try:
                vec = extract_features(audio_file)
                X_raw.append(vec)
                labels.append(label_id)
                count += 1
            except Exception as e:
                print(f"  [!] Failed to extract features from '{audio_file}': {e}")

        if count > 0:
            species_sample_counts[label_id] = count
            print(f"  [+] Loaded category='{category}', species='{clean_species}' ({count} audio file)")

    if not X_raw:
        raise ValueError(f"No valid audio files could be processed in '{data_dir}'. Ensure supported files (WAV, MP3, OGG, FLAC) exist.")

    X_raw = np.array(X_raw)
    labels = np.array(labels)

    # Standardize all feature vectors
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_raw)

    # Compute reference profile centroids per species/label
    unique_labels = sorted(list(species_sample_counts.keys()))
    centroids = {}

    for label_id in unique_labels:
        indices = np.where(labels == label_id)[0]
        species_vectors = X_scaled[indices]
        centroid_vec = np.mean(species_vectors, axis=0)
        centroids[label_id] = centroid_vec.tolist()

    categories = sorted(list(set(meta["category"] for meta in species_metadata.values())))

    # Save model artifact
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    model_payload = {
        "scaler": scaler,
        "centroids": centroids,
        "species_metadata": species_metadata,
        "species_list": unique_labels,
        "categories": categories,
        "feature_dim": int(X_raw.shape[1]),
        "sample_count": len(X_raw),
        "samples_per_species": species_sample_counts,
        "trained_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    joblib.dump(model_payload, model_path)
    print(f"[+] Model successfully trained on {len(X_raw)} samples across {len(unique_labels)} species profiles.")
    print(f"[+] Persisted to '{model_path}'.")

    return model_payload

if __name__ == "__main__":
    train_model()
