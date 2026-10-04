import sys
from pathlib import Path

from joblib import load
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from Backend.LLM.llm_groq import get_vehicle_info

MODEL_DIR = Path(__file__).resolve().parent
pipeline = load(str(MODEL_DIR / 'car_price_predictor_pipeline.pkl'))
info = load(str(MODEL_DIR / 'model_info.pkl'))


def fetch_model_info(model):
    return get_vehicle_info(model)


def ask_choice(name, options):
    while True:
        v = input(f"{name} {sorted(options)}: ").strip().lower()
        if v in options:
            if name == 'model':
                vehicle_info = fetch_model_info(v)
                if vehicle_info:
                    production_start = vehicle_info.get('production_start_year')
                    production_end = vehicle_info.get('production_end_year')
                    transmissions = vehicle_info.get('transmissions') or []
                    fuel_types = vehicle_info.get('fuel_types') or []
                    summary = vehicle_info.get('summary')

                    print(f"\nModel info for {v}:")
                    print(f"Production: {production_start} - {production_end if production_end is not None else 'present'}")
                    print(f"Transmissions: {', '.join(transmissions) if transmissions else 'N/A'}")
                    print(f"Fuel types: {', '.join(fuel_types) if fuel_types else 'N/A'}")
                    if summary:
                        print(summary)
            return v
        print("Invalid choice, try again.")

def ask_num(name, cast, lo, hi):
    while True:
        try:
            v = cast(input(f"{name} ({lo:g} to {hi:g}): "))
        except ValueError:
            print("Enter a valid number.")
            continue
        if lo <= v <= hi:
            return v
        print(f"Out of range for this model, enter {lo:g} to {hi:g}.")

def main():
    model = ask_choice('model', list(info))
    model_info = info[model]

    row = pd.DataFrame([{
        'model': model,
        'year': ask_num('year', int, *model_info['year']),
        'transmission': ask_choice('transmission', model_info['transmission']),
        'mileage': ask_num('mileage', int, *model_info['mileage']),
        'fuelType': ask_choice('fuelType', model_info['fuelType']),
        'tax': ask_num('tax', int, *model_info['tax']),
        'mpg': ask_num('mpg', float, *model_info['mpg']),
        'engineSize': ask_num('engineSize', float, *model_info['engineSize']),
    }])

    print(f"Predicted price: £{pipeline.predict(row)[0]:,.0f}")


if __name__ == "__main__":
    main()