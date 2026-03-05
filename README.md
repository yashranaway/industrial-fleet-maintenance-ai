# Industrial Fleet Maintenance AI

A predictive maintenance dashboard that uses machine learning to predict equipment failures and IBM Granite (via Replicate) for AI-powered diagnostics.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?logo=tailwindcss)
![Replicate](https://img.shields.io/badge/IBM%20Granite-Replicate-blue)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (Pages Router) |
| **UI** | Tailwind CSS, shadcn/ui, Radix UI |
| **Charts** | Recharts |
| **Animations** | Framer Motion, @paper-design/shaders-react |
| **Icons** | Lucide React |
| **AI Model** | IBM Granite 3.0 (8B Instruct) via Replicate API |
| **ML Prediction** | Logistic Regression (runs in-browser via JS) |
| **Dataset** | UCI Predictive Maintenance Dataset |

---

## Project Structure

```
SE/
├── frontend/
│   ├── pages/
│   │   ├── index.js              # Main dashboard UI
│   │   ├── _app.js               # App wrapper with global styles
│   │   └── api/
│   │       ├── predict.js         # ML prediction endpoint (Logistic Regression)
│   │       └── explain.js         # AI diagnosis endpoint (IBM Granite + fallback)
│   ├── components/ui/             # shadcn/ui components
│   ├── public/model/              # Exported model artifacts (JSON)
│   │   ├── lr_params.json         # Logistic Regression weights
│   │   ├── scaler.json            # Feature scaler parameters
│   │   ├── encoder.json           # Label encoder mappings
│   │   ├── features.json          # Feature names
│   │   └── metrics.json           # Model performance metrics
│   ├── styles/globals.css         # Global styles + Tailwind
│   ├── tailwind.config.js
│   └── package.json
├── artifacts/                     # Python-trained model files (.pkl)
├── data/
│   └── predictive_maintenance.csv # Training dataset
├── report_assets/                 # Model evaluation charts
│   ├── confusion_matrix.png
│   ├── feature_importance.png
│   ├── model_comparison.png
│   └── roc_curve.png
└── .gitignore
```

---

## Installation

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **npm** (comes with Node.js)
- **Replicate API Token** ([get one here](https://replicate.com/account/api-tokens))

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/yashranaway/industrial-fleet-maintenance-ai.git
cd industrial-fleet-maintenance-ai

# 2. Navigate to frontend
cd frontend

# 3. Install dependencies
npm install

# 4. Create environment file
cp .env.local.example .env.local
# Edit .env.local and add your Replicate API token:
#   REPLICATE_API_TOKEN=your_token_here

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

---

## Environment Variables

Create a `.env.local` file inside the `frontend/` directory:

```env
REPLICATE_API_TOKEN=your_replicate_api_token
```

| Variable | Required | Description |
|----------|----------|-------------|
| `REPLICATE_API_TOKEN` | Yes | API token from [Replicate](https://replicate.com/account/api-tokens) for IBM Granite model |

> **Note:** If the Replicate API is unavailable or times out (>15s), the app automatically falls back to pre-built diagnostic responses based on the failure probability.

---

## API Endpoints

### `POST /api/predict`

Runs the logistic regression model on sensor inputs and returns failure predictions.

**Request Body:**
```json
{
  "air_temperature_K": 300.1,
  "process_temperature_K": 310.5,
  "rotational_speed_rpm": 1500,
  "torque_Nm": 42.3,
  "tool_wear_min": 108,
  "type": "M"
}
```

**Response:**
```json
{
  "inputs": { ... },
  "predictions": {
    "xgboost": { "label": 0, "prob": 0.12 },
    "random_forest": { "label": 0, "prob": 0.12 },
    "logistic_regression": { "label": 0, "prob": 0.12 }
  }
}
```

### `POST /api/explain`

Sends sensor data to IBM Granite for AI-powered failure diagnosis. Falls back to pre-built responses on timeout/error.

**Request Body:**
```json
{
  "air_temperature_K": 300.1,
  "process_temperature_K": 310.5,
  "rotational_speed_rpm": 1500,
  "torque_Nm": 42.3,
  "tool_wear_min": 108,
  "type": "M",
  "prediction_prob": 0.12
}
```

**Response:**
```json
{
  "text": "1. Diagnosis: ... 2. Action: ...",
  "fallback": false,
  "rateLimits": {
    "remaining": "598",
    "reset": "2026-03-06T00:00:00Z"
  }
}
```

---

## Documentation

### How It Works

1. **Input** - User enters machine sensor readings (temperature, RPM, torque, tool wear, machine type).
2. **Prediction** - The `/api/predict` endpoint runs a logistic regression model (exported from Python as JSON) to calculate failure probability.
3. **Dashboard** - Results are displayed with model comparison metrics, accuracy stats, and visual indicators.
4. **AI Diagnosis** - Clicking "Analyze Failure Risk" sends data to IBM Granite (via Replicate) which returns a concise diagnosis and recommended action.
5. **Fallback** - If the AI model is slow (>15s) or unavailable, pre-built responses categorized by risk level (low/medium/high) are streamed to the UI.

### Model Details

- **Training Data**: UCI Predictive Maintenance Dataset (10,000 records, 6 features)
- **Models Trained**: XGBoost, Random Forest, Logistic Regression
- **Deployed Model**: Logistic Regression (runs entirely in JavaScript — no Python backend needed)
- **Features**: Air Temperature (K), Process Temperature (K), Rotational Speed (RPM), Torque (Nm), Tool Wear (min), Machine Type (H/L/M)

### AI Fallback System

The explain API includes 15 pre-written diagnostic responses across 3 severity categories:
- **Low risk** (prob < 30%): 5 responses — routine monitoring advice
- **Medium risk** (30-70%): 5 responses — preventive maintenance recommendations
- **High risk** (prob > 70%): 5 responses — urgent action required

Responses are streamed character-by-character to simulate real-time AI generation.

---

## License

MIT
