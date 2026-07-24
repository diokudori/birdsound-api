# To run the application, execute:
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Walkthrough - Nested Category & Bird Name Directory Mapping

We updated the bioacoustic training & classification pipeline to support nested directory hierarchies: `./data/train/<bird_category>/<bird_name>/*.mp3`.

## 📂 Multi-Level Directory Structure Support

The dataset scanner (`backend/trainer.py`) now recursively inspects `./data/train/` to extract both the **Bird Category** and **Bird Species Name**:

- **Input Folder Path:** `./data/train/Jenis Burung Lomba/1. Burung Murai Batu/Burung Murai Batu.mp3`
  - **Category:** `Jenis Burung Lomba`
  - **Clean Species Name:** `Burung Murai Batu`
- **Input Folder Path:** `./data/train/Jenis Burung Masteran/12. Burung Lovebird/Burung Lovebird.mp3`
  - **Category:** `Jenis Burung Masteran`
  - **Clean Species Name:** `Burung Lovebird`
- **Input Folder Path:** `./data/train/Jenis Burung Hias/1. Burung Village Indigo Bird/Burung Village Indigo Bird .mp3`
  - **Category:** `Jenis Burung Hias`
  - **Clean Species Name:** `Burung Village Indigo Bird`

---

## 🎯 Verified Classification Outputs

### 1. `Burung Murai Batu.mp3` (Category: `Jenis Burung Lomba`):
```json
{
  "top_match": {
    "category": "Jenis Burung Lomba",
    "species": "Burung Murai Batu",
    "similarity_score": "100.00%"
  },
  "all_matches": [
    {
      "category": "Jenis Burung Lomba",
      "species": "Burung Murai Batu",
      "similarity": "100.00%"
    },
    {
      "category": "Jenis Burung Lomba",
      "species": "Burung Cucak Hijau",
      "similarity": "61.38%"
    }
  ]
}
```

### 2. `Burung Lovebird.mp3` (Category: `Jenis Burung Masteran`):
```json
{
  "top_match": {
    "category": "Jenis Burung Masteran",
    "species": "Burung Lovebird",
    "similarity_score": "100.00%"
  }
}
```

### 3. `Burung Village Indigo Bird.mp3` (Category: `Jenis Burung Hias`):
```json
{
  "top_match": {
    "category": "Jenis Burung Hias",
    "species": "Burung Village Indigo Bird",
    "similarity_score": "100.00%"
  }
}
```

---

## 📊 Summary Statistics
- **Total Categories Detected:** 4 (`Jenis Burung Hias`, `Jenis Burung Lomba`, `Jenis Burung Masteran`, `Suara Campuran 3 hewan`)
- **Total Species Profiles Trained:** 57
- **Total Audio Files Processed:** 57
