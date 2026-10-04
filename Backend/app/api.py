import logging

import pandas as pd
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from Backend.app.pydantic_models import (
    CarData,
    CarModelConstraints,
    CarPredictionResponse,
)
from Backend.ML.predict import fetch_model_info, info, pipeline

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Car Price Prediction for Ford",
    description="ML model for predicting car prices based on various features.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)


def _get_model_constraints(
    model_name: str,
    error_status: int = status.HTTP_422_UNPROCESSABLE_ENTITY,
) -> dict:
    model_constraints = info.get(model_name)
    if model_constraints is None:
        raise HTTPException(
            status_code=error_status,
            detail=f"Unsupported car model: {model_name}",
        )
    return model_constraints


def _get_vehicle_info(model_name: str) -> dict:
    try:
        return fetch_model_info(model_name)
    except Exception as exc:
        logger.exception("Could not fetch vehicle information for %s", model_name)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve vehicle information",
        ) from exc


@app.get("/models", response_model=list[str])
async def get_models():
    return sorted(info)


@app.get("/models/{model_name}/constraints", response_model=CarModelConstraints)
async def get_model_constraints(model_name: str):
    return _get_model_constraints(model_name, status.HTTP_404_NOT_FOUND)


@app.get("/model_info/{model_name}", response_model=dict)
async def get_model_info(model_name: str):
    _get_model_constraints(model_name, status.HTTP_404_NOT_FOUND)
    model_info = _get_vehicle_info(model_name)
    if not model_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model information not found",
        )
    return model_info


@app.post("/predict", response_model=CarPredictionResponse)
async def predict_price(car_data: CarData):
    model_constraints = _get_model_constraints(car_data.car_model)

    for field in ("transmission", "fuelType"):
        if getattr(car_data, field) not in model_constraints[field]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unsupported {field} for {car_data.car_model}",
            )

    for field in ("year", "mileage", "tax", "mpg", "engineSize"):
        value = getattr(car_data, field)
        minimum, maximum = model_constraints[field]
        if not minimum <= value <= maximum:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field} must be between {minimum} and {maximum} for {car_data.car_model}",
            )

    row = pd.DataFrame(
        [
            {
                "model": car_data.car_model,
                "year": car_data.year,
                "transmission": car_data.transmission,
                "mileage": car_data.mileage,
                "fuelType": car_data.fuelType,
                "tax": car_data.tax,
                "mpg": car_data.mpg,
                "engineSize": car_data.engineSize,
            }
        ]
    )
    predicted_price = float(pipeline.predict(row)[0])
    model_info = _get_vehicle_info(car_data.car_model)
    if not model_info:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not retrieve vehicle information",
        )
    return CarPredictionResponse(
        predicted_price=predicted_price,
        model_info=model_info,
    )