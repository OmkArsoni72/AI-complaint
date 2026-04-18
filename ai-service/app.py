from fastapi import FastAPI
import pickle
import time

app = FastAPI()

# Load vectorizer
with open("final_vectorizer.pkl", "rb") as f:
    vectorizer = pickle.load(f)

# Load model
with open("final_model.pkl", "rb") as f:
    model = pickle.load(f)


@app.post("/predict")
def predict(data: dict):
    text = data.get("text")

    if not isinstance(text, str) or not text.strip():
        return {"error": "text is required"}

    # Step 1: Convert text to vector
    start = time.time()
    vector = vectorizer.transform([text])

    # Step 2: Predict
    prediction = model.predict(vector)[0]

    duration_ms = int((time.time() - start) * 1000)
    print(f"[ai-service] text='{text[:80]}' -> category='{prediction}' ({duration_ms}ms)")

    return {
        "category": prediction
    }


@app.get("/model-info")
def model_info():
    classes = getattr(model, "classes_", [])
    return {
        "labels": [str(c) for c in classes],
        "labels_count": len(classes),
        "model_type": type(model).__name__,
        "vectorizer_type": type(vectorizer).__name__,
    }