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

classifier_instance = BirdClassifier()
