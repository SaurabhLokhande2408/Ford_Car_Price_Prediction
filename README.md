# Ford Used-Car Price Prediction

Estimate the resale price of a used Ford based on its model, year, mileage, transmission, fuel type, road tax, fuel economy, and engine size. A Random Forest model trained on UK used-car listings is served through a FastAPI backend, accompanied by a React frontend for browser-based testing.

> **The primary focus of this project is the machine learning model and the backend API.** The frontend is a mock interface designed to make the model easy to interact with and is not production-grade.

---

## What I Learned Building This

This project marked my hands-on experience with several key technologies and concepts:

* **Random Forest Regression:** Learned how `RandomForestRegressor` operates via an ensemble of decision trees trained on bootstrapped data samples, with predictions averaged to reduce variance. Gained experience evaluating regression models using R², MAE, and RMSE, and analyzing residual errors rather than relying solely on aggregate headline metrics.
* **Scikit-Learn Pipelines:** Combined data scaling, one-hot encoding, and the regression model into a single unified `Pipeline`, ensuring identical data preprocessing logic during both offline training and online serving.
* **LLM Integration:** Integrated the Groq API to programmatically fetch structured background information about specific car models as JSON. Learned to craft system prompts, enforce strict JSON output formatting, set `temperature=0` for deterministic parsing, and handle API connection failures gracefully.
* **FastAPI Model Serving:** Implemented robust request body validation using Pydantic, structured proper HTTP error responses, and designed input-checking constraints aligned with the model's training boundaries.

---

## How It Works

```text
React frontend  ──►  FastAPI backend  ──►  Random Forest pipeline  (predicted price)
 (frontend/)         (Backend/app)    └──►  Groq LLM                (car background info)
```

1. **Model Loading:** The frontend fetches the list of available car models from `/models`.
2. **Constraint Fetching:** Selecting a model loads its valid boundary ranges via `/models/{name}/constraints`, ensuring the form restricts submissions to values the model has encountered in training.
3. **Inference Execution:** Submitting the form triggers `/predict`, which validates input parameters, executes the preprocessing pipeline, and returns the estimated price.
4. **Context Enrichment:** An asynchronous LLM call fetches model background information (production years, standard transmissions, fuel types, and a summary). This is displayed alongside the price and **does not influence the numeric prediction**.

---

## The Model

* **Dataset:** `Backend/data/ford.csv` containing 17,966 UK used-Ford listings. Post-cleaning yielded 17,810 rows covering 23 models, production years 1996 to 2020, and price ranges from £495 to £54,995.

### Data Cleaning Steps
* Removed rows with fuel type `Other` and one out-of-bounds anomaly year (`2060`).
* Imputed missing/zero engine sizes with the dataset mean (`engineSize == 0`).
* Dropped 154 duplicate rows.
* Standardized string casing and stripped whitespace across `model`, `transmission`, and `fuelType`.

### Pipeline Architecture
* **Numeric Features (`year`, `mileage`, `tax`, `mpg`, `engineSize`):** Scaled using `StandardScaler`.
* **Categorical Features (`model`, `transmission`, `fuelType`):** Encoded using `OneHotEncoder(drop="first", handle_unknown="ignore")`.
* **Estimator:** `RandomForestRegressor(n_estimators=200, random_state=42)` with unconstrained tree depth.
* **Data Split:** Trained on 80% of the dataset; tested on the remaining 20% (3,562 listings).

### Test Set Performance Metrics

| Metric | Value |
| :--- | :--- |
| **R² Score** | **0.928** |
| **Mean Absolute Error (MAE)** | **£877** |
| **Root Mean Squared Error (RMSE)** | **£1,249** |

### Accuracy Breakdown by Price Bracket (MAE)

| Actual Price Range | Mean Absolute Error | Test Listings Count |
| :--- | :--- | :--- |
| **Under £10k** | £633 | 1,309 |
| **£10k to £20k** | £944 | 2,088 |
| **£20k to £30k** | £1,912 | 153 |
| **Over £30k** | £2,465 | 12 |

The model demonstrates high reliability for everyday mid-range vehicles while exhibiting higher variance on luxury or performance brackets due to sample scarcity. Similarly, high-volume models (Fiesta, Focus, Kuga) yield accurate estimations, whereas niche models (Mustang, Tourneo Custom, Puma) show increased prediction error given limited training representations.

> Detailed exploratory data analysis, plotting, residual analysis, training scripts, and evaluation logs are available in [`Backend/ML/ml.ipynb`](Backend/ML/ml.ipynb).

---

## How the LLM is Used

[`Backend/LLM/llm_groq.py`](Backend/LLM/llm_groq.py) interacts with the Groq API (`openai/gpt-oss-120b`) using a strict system prompt designed to enforce valid JSON schema responses containing exact keys: `production_start_year`, `production_end_year`, `transmissions`, `fuel_types`, and `summary`. The prompt instructs the model to return `null` rather than hallucinate unverified specifications. Because LLM outputs can occasionally drift, this data is intended purely for supplementary context.

---

## API Reference

| Method | Endpoint | Returns |
| :--- | :--- | :--- |
| **GET** | `/models` | Array of supported car model names |
| **GET** | `/models/{model_name}/constraints` | Boundary bounds (`[min, max]`) for numeric features and allowed categorical options |
| **GET** | `/model_info/{model_name}` | LLM-generated background context for the specified model |
| **POST** | `/predict` | JSON response containing `predicted_price` and `model_info` |

Interactive Swagger documentation is available at `http://127.0.0.1:8000/docs` while the FastAPI server is active.

### Example Requests & Responses

* **`GET /models/b-max/constraints`**
  ```json
  {
    "year": [2012, 2018],
    "mileage": [937, 73324],
    "tax": [0, 165],
    "mpg": [44.1, 80.7],
    "engineSize": [1.0, 1.6],
    "transmission": ["semi-auto", "manual", "automatic"],
    "fuelType": ["petrol", "diesel"]
  }
  ```

* **`POST /predict`**
  ```json
  {
    "car_model": "fiesta",
    "year": 2017,
    "transmission": "manual",
    "mileage": 15000,
    "fuelType": "petrol",
    "tax": 150,
    "mpg": 57.7,
    "engineSize": 1.0
  }
  ```

> **Error Codes:** Requests with unknown models, unsupported categories, or out-of-bound numerical constraints return a `422 Unprocessable Entity` validation error. If the auxiliary Groq LLM lookup fails during execution, the API returns a `502 Bad Gateway` error.

---

## Project Structure

```text
Backend/
  app/       FastAPI application (api.py) and Pydantic schemas (pydantic_models.py)
  ML/        ml.ipynb, predict.py (CLI interface), model_info.pkl,
             car_price_predictor_pipeline.pkl (Git LFS tracked, ~253 MB)
  LLM/       llm_groq.py (Groq API integration for model background data)
  data/      ford.csv (cleaned dataset)
frontend/    React + Vite mock interface application
```

---

## Getting Started

### Prerequisites
* **Python 3.11** (matching the training and notebook environment)
* **Node.js 18+**
* **Git LFS** ([Installation Guide](https://git-lfs.com))
* Free **Groq API Key** ([Get Key](https://console.groq.com))

### 1. Clone the Repository (with Git LFS)
The trained scikit-learn pipeline object is approximately 253 MB and managed via Git LFS. Skipping LFS pulls will result in a placeholder pointer file, causing backend startup failures.

```bash
git lfs install
git clone https://github.com/SaurabhLokhande2408/Ford_Car_Price_Prediction.git
cd Ford_Car_Price_Prediction
git lfs pull          # Run this if cloned prior to setting up Git LFS
```

### 2. Configure and Run the Backend

```bash
python -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate
pip install fastapi "uvicorn[standard]" pandas scikit-learn joblib groq python-dotenv
```

Create a `.env` file inside the `Backend/` directory:
```text
GROQ_API_KEY=your_key_here
```

Launch the FastAPI development server from the repository root:
```bash
python -m uvicorn Backend.app.api:app --reload --port 8000
```

> **Note:** Because the pipeline is saved as a joblib pickle file, ensure you use the same scikit-learn version it was trained with to avoid version mismatch errors.

### 3. Configure and Run the Frontend

Open a separate terminal window for the frontend interface:
```bash
cd frontend
npm install
npm run dev          # Starts local server at http://localhost:5173
```

The frontend expects the backend API at `http://127.0.0.1:8000`. To customize this, copy `frontend/.env.example` to `frontend/.env` and update `VITE_API_URL`. The backend natively allows CORS from standard local development origins.

### Optional: Command-Line Interface (CLI) Version
```bash
python -m Backend.ML.predict
```
The CLI interactively prompts for car attributes, executes price estimation locally, and prints the results alongside the Groq LLM background breakdown.

---

## Limitations & Future Improvements

* **Data Scope Constraints:** Restricted to 23 specific Ford models and value ranges present in the original training distribution. It cannot accurately price alternative manufacturers or out-of-range vehicles, showing higher uncertainty for rare models and high-value listings over £20k.
* **Single Train/Test Split:** Cross-validation routines are outlined within the notebook but commented out; current scores reflect a single static data split.
* **Model Artifact Size:** Fully unconstrained decision trees inflate the saved pipeline size to ~253 MB. Applying depth limits or tree pruning would reduce artifact size, though validation testing would be required to quantify any impact on accuracy.
* **Coupled LLM Dependency:** The `/predict` endpoint synchronously queries Groq during inference. An LLM failure currently blocks the price response even though pricing calculations complete successfully. A decoupled design would serve price predictions immediately and treat background info asynchronously.
* **Testing & Dependency Pinning:** Implementation of automated testing suites and strict dependency locking (`requirements.txt` / poetry configurations) are planned for future versions.

---

## Tech Stack

**Languages & Libraries:** Python · pandas · scikit-learn · FastAPI · Pydantic · Groq API  
**Frontend:** React · Vite · Tailwind CSS  
**Tooling & Deployment:** Git LFS · Vercel · Railway

---

## Author

**Saurabh Lokhande**

* GitHub: [@SaurabhLokhande2408](https://github.com/SaurabhLokhande2408)
* LinkedIn: [saurabh-lokhande](https://www.linkedin.com/in/saurabh-lokhande-111459376)
