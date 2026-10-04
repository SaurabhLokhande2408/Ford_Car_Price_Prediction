import json
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

SYSTEM_PROMPT = """You are a vehicle expert for the UK market.

Reply with JSON only, using exactly these keys:

{
  "production_start_year": integer,
  "production_end_year": integer or null if still in production,
  "transmissions": list of strings,
  "fuel_types": list of strings,
  "summary": one short sentence
}

If you are unsure of a value, use null. Never guess.
"""


def get_vehicle_info(vehicle):
    client = Groq()
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{vehicle}, UK market"},
        ],
        temperature=0,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )

    text = response.choices[0].message.content

    return json.loads(text)
