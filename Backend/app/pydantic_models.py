from pydantic import BaseModel, Field


class CarModelConstraints(BaseModel):
    year: tuple[float, float]
    mileage: tuple[float, float]
    tax: tuple[float, float]
    mpg: tuple[float, float]
    engineSize: tuple[float, float]
    transmission: list[str]
    fuelType: list[str]

class CarData(BaseModel):
    car_model: str = Field(..., description="The model of the car")
    transmission: str = Field(..., description="The transmission type of the car")
    mpg: float = Field(..., description="Miles per gallon of the car")
    mileage: int = Field(..., description="Mileage of the car")
    tax: int = Field(..., description="Road tax for the car")
    engineSize: float = Field(..., description="Engine size of the car")
    year: int = Field(..., description="Year of the car")
    fuelType: str = Field(..., description="Fuel type of the car")

class CarPredictionResponse(BaseModel):
    predicted_price: float = Field(..., description="The predicted price of the car")
    model_info: dict = Field(..., description="Additional information about the car model")