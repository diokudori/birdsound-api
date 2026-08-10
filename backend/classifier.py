import os
import io
import joblib
import numpy as np
from typing import Union, Dict, Any
from backend.feature_extractor import extract_features

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "models", "bird_classifier.joblib")

class BirdClassifier:
    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model_payload = None
        self.load_model()

    def load_model(self) -> bool:
        if os.path.exists(self.model_path):
            try:
                self.model_payload = joblib.load(self.model_path)
                return True
            except Exception as e:
                print(f"[!] Failed loading model artifact '{self.model_path}': {e}")
                self.model_payload = None
                return False
        self.model_payload = None
        return False

    @property
    def is_trained(self) -> bool:
        if self.model_payload is None:
            self.load_model()
        return self.model_payload is not None

    def get_status(self) -> Dict[str, Any]:
        if not self.is_trained:
            self.load_model()

        if self.is_trained:
            species_metadata = self.model_payload.get("species_metadata", {})
            species_display_list = []
            for label_id, meta in species_metadata.items():
                species_display_list.append({
                    "category": meta.get("category", "General"),
                    "species": meta.get("species", label_id),
                    "label_id": label_id
                })

            return {
                "is_trained": True,
                "species_count": len(self.model_payload.get("species_list", [])),
                "categories": self.model_payload.get("categories", []),
                "species_list": species_display_list,
                "sample_count": self.model_payload.get("sample_count", 0),
                "samples_per_species": self.model_payload.get("samples_per_species", {}),
                "trained_at": self.model_payload.get("trained_at")
            }
        else:
            return {
                "is_trained": False,
                "species_count": 0,
                "categories": [],
                "species_list": [],
                "sample_count": 0,
                "samples_per_species": {},
                "trained_at": None
            }

    def classify_audio(self, audio_source: Union[bytes, io.BytesIO]) -> Dict[str, Any]:
        """
        Extracts features, normalizes vector, computes cosine similarity against
        trained species centroids, and returns formatted category + species rankings.
        """
        if not self.is_trained:
            if not self.load_model():
                raise RuntimeError("Model is uncalibrated/untrained. Please run training first.")

        # Extract 44-dimensional feature vector
        raw_features = extract_features(audio_source)
        scaler = self.model_payload["scaler"]
        centroids = self.model_payload["centroids"]
        species_metadata = self.model_payload.get("species_metadata", {})

        # Scale features using stored StandardScaler
        scaled_vec = scaler.transform(raw_features.reshape(1, -1))[0]
        norm_input = np.linalg.norm(scaled_vec)

        if norm_input == 0:
            norm_input = 1e-6

        matches = []
        for label_id, centroid_list in centroids.items():
            centroid_vec = np.array(centroid_list)
            norm_centroid = np.linalg.norm(centroid_vec)
            if norm_centroid == 0:
                norm_centroid = 1e-6

            # Cosine similarity calculation
            cosine_sim = np.dot(scaled_vec, centroid_vec) / (norm_input * norm_centroid)
            
            # Map cosine similarity (-1 to +1) to percentage score (0% to 100%)
            percentage = max(0.0, float(cosine_sim)) * 100.0

            meta = species_metadata.get(label_id, {})
            category = meta.get("category", "General")
            clean_species = meta.get("species", label_id)
            
            matches.append({
                "label_id": label_id,
                "category": category,
                "species": clean_species,
                "raw_score": float(cosine_sim),
                "percentage_num": percentage,
                "similarity": f"{percentage:.2f}%"
            })

        # Sort matches by similarity percentage descending
        matches.sort(key=lambda x: x["percentage_num"], reverse=True)

        top_match = matches[0] if matches else None
        
        all_matches_formatted = [
            {
                "category": m["category"],
                "species": m["species"],
                "similarity": m["similarity"]
            }
            for m in matches
        ]

        top_match_formatted = {
            "category": top_match["category"] if top_match else "Unknown",
            "species": top_match["species"] if top_match else "Unknown",
            "similarity_score": top_match["similarity"] if top_match else "0.00%"
        }

        return {
            "top_match": top_match_formatted,
            "all_matches": all_matches_formatted
        }

    def classify_audio_multi(self, audio_source: Union[bytes, io.BytesIO]) -> Dict[str, Any]:
        """
        Splits the audio on gaps (silence), extracts features and classifies each block,
        returning segment-by-segment top match results and calculations.
        """
        import librosa
        import tempfile
        
        if not self.is_trained:
            if not self.load_model():
                raise RuntimeError("Model is uncalibrated/untrained. Please run training first.")

        y = None
        sr = 22050
        
        # Read raw bytes
        try:
            if isinstance(audio_source, bytes):
                audio_bytes = audio_source
            else:
                audio_source.seek(0)
                audio_bytes = audio_source.read()
                
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name
                
            try:
                y, sr = librosa.load(temp_file_path, sr=22050)
            finally:
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
        except Exception as e:
            raise ValueError(f"Could not decode audio for multi-class classification: {str(e)}")

        if y is None or len(y) == 0:
            raise ValueError("Audio stream is empty or unreadable.")

        # Determine dynamic top_db based on the RMS energy profile of this audio file
        try:
            rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
            db = librosa.amplitude_to_db(rms, ref=np.max)
            # Find the quietest 15th percentile of frames as the noise floor estimate
            noise_floor_db = np.percentile(db, 15)
            # Threshold should be 12 dB above the noise floor, but clamped between -15 dB and -35 dB
            threshold_db = min(-15.0, max(-35.0, noise_floor_db + 12.0))
            top_db = -threshold_db
        except Exception:
            top_db = 25.0 # fallback

        # Split audio by silence
        raw_intervals = librosa.effects.split(y, top_db=top_db, frame_length=2048, hop_length=512)
        
        # Merge sub-intervals separated by brief silence gaps (< 0.5 seconds)
        intervals_list = []
        min_gap_samples = int(0.5 * sr) # 0.5s gap threshold
        
        for interval in raw_intervals:
            if not intervals_list:
                intervals_list.append([interval[0], interval[1]])
            else:
                prev_start, prev_end = intervals_list[-1]
                curr_start, curr_end = interval
                if curr_start - prev_end < min_gap_samples:
                    intervals_list[-1][1] = curr_end
                else:
                    intervals_list.append([curr_start, curr_end])
        
        intervals = np.array(intervals_list)
        
        # Fall back to single full segment if no silence gaps are found
        if len(intervals) == 0:
            intervals = np.array([[0, len(y)]])

        segments_results = []
        scaler = self.model_payload["scaler"]
        centroids = self.model_payload["centroids"]
        species_metadata = self.model_payload.get("species_metadata", {})

        for idx, interval in enumerate(intervals):
            start_sample, end_sample = interval
            start_sec = float(start_sample) / sr
            end_sec = float(end_sample) / sr
            duration_sec = end_sec - start_sec

            # Skip extremely short clips (< 0.2s)
            if duration_sec < 0.2:
                continue

            segment_y = y[start_sample:end_sample]
            
            try:
                # 1. 20 MFCCs (Mean & Std Dev)
                mfcc = librosa.feature.mfcc(y=segment_y, sr=sr, n_mfcc=20)
                mfcc_mean = np.mean(mfcc, axis=1)
                mfcc_std = np.std(mfcc, axis=1)

                # 2. Spectral Centroid (Mean & Std Dev)
                centroid = librosa.feature.spectral_centroid(y=segment_y, sr=sr)
                cent_mean = np.array([np.mean(centroid)])
                cent_std = np.array([np.std(centroid)])

                # 3. Spectral Rolloff (Mean)
                rolloff = librosa.feature.spectral_rolloff(y=segment_y, sr=sr)
                rolloff_mean = np.array([np.mean(rolloff)])

                # 4. Zero Crossing Rate (Mean)
                zcr = librosa.feature.zero_crossing_rate(y=segment_y)
                zcr_mean = np.array([np.mean(zcr)])

                raw_features = np.hstack([
                    mfcc_mean,
                    mfcc_std,
                    cent_mean,
                    cent_std,
                    rolloff_mean,
                    zcr_mean
                ])

                scaled_vec = scaler.transform(raw_features.reshape(1, -1))[0]
                norm_input = np.linalg.norm(scaled_vec)
                if norm_input == 0:
                    norm_input = 1e-6

                segment_matches = []
                for label_id, centroid_list in centroids.items():
                    centroid_vec = np.array(centroid_list)
                    norm_centroid = np.linalg.norm(centroid_vec)
                    if norm_centroid == 0:
                        norm_centroid = 1e-6

                    cosine_sim = np.dot(scaled_vec, centroid_vec) / (norm_input * norm_centroid)
                    percentage = max(0.0, float(cosine_sim)) * 100.0

                    meta = species_metadata.get(label_id, {})
                    category = meta.get("category", "General")
                    clean_species = meta.get("species", label_id)

                    segment_matches.append({
                        "category": category,
                        "species": clean_species,
                        "percentage_num": percentage,
                        "similarity": f"{percentage:.2f}%"
                    })

                segment_matches.sort(key=lambda x: x["percentage_num"], reverse=True)
                top_match = segment_matches[0] if segment_matches else None
                
                if top_match:
                    segments_results.append({
                        "segment_index": len(segments_results) + 1,
                        "start_time": round(start_sec, 2),
                        "end_time": round(end_sec, 2),
                        "duration": round(duration_sec, 2),
                        "category": top_match["category"],
                        "species": top_match["species"],
                        "similarity": top_match["similarity"],
                        "percentage_num": top_match["percentage_num"]
                    })
            except Exception as seg_err:
                print(f"[!] Error classifying segment {idx}: {seg_err}")

        # Fallback to standard classification if segments failed
        if not segments_results:
            try:
                whole_res = self.classify_audio(audio_source)
                top_m = whole_res["top_match"]
                segments_results.append({
                    "segment_index": 1,
                    "start_time": 0.0,
                    "end_time": round(len(y) / sr, 2),
                    "duration": round(len(y) / sr, 2),
                    "category": top_m["category"],
                    "species": top_m["species"],
                    "similarity": top_m["similarity_score"],
                    "percentage_num": float(top_m["similarity_score"].replace('%', ''))
                })
            except Exception:
                pass

        # Sort segments to find overall best segment match
        best_segment = max(segments_results, key=lambda x: x["percentage_num"]) if segments_results else None
        
        top_match_formatted = {
            "category": best_segment["category"] if best_segment else "Unknown",
            "species": best_segment["species"] if best_segment else "Unknown",
            "similarity_score": best_segment["similarity"] if best_segment else "0.00%"
        }

        all_matches_formatted = [
            {
                "category": seg["category"],
                "species": f"Segment {seg['segment_index']} ({seg['start_time']}s - {seg['end_time']}s) | {seg['species']}",
                "similarity": seg["similarity"]
            }
            for seg in segments_results
        ]

        return {
            "top_match": top_match_formatted,
            "all_matches": all_matches_formatted,
            "is_multi": True,
            "segments": segments_results
        }

classifier_instance = BirdClassifier()
