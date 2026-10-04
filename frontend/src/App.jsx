import { useEffect, useState } from "react";
import { API_BASE, LINKS } from "./config";

const NUMERIC = [
  { key: "year", label: "Year", step: 1, int: true },
  { key: "mileage", label: "Mileage", step: 1, int: true, unit: "miles" },
  { key: "tax", label: "Road tax", step: 1, int: true, unit: "£ / year" },
  { key: "mpg", label: "Fuel economy", step: 0.1, unit: "mpg" },
  { key: "engineSize", label: "Engine size", step: 0.1, unit: "litres" },
];

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function detailText(body, status) {
  const d = body && body.detail;

  if (typeof d === "string") return d;

  if (Array.isArray(d)) {
    return d
      .map((x) => `${(x.loc || []).slice(1).join(".") || "input"}: ${x.msg}`)
      .join("; ");
  }

  return `The API returned an error (HTTP ${status}).`;
}

async function api(path, options) {
  let res;

  try {
    res = await fetch(API_BASE + path, options);
  } catch (e) {
    if (e.name === "AbortError") throw e;

    throw new ApiError(
      `Can't reach the API at ${API_BASE}. Check that the backend is running and CORS allows this page.`
    );
  }

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(detailText(body, res.status), res.status);
  }

  return body;
}

const pretty = (s = "") =>
  s.replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

const gbp = (n) => "£" + Math.round(n).toLocaleString("en-GB");

const fmt = (n) =>
  Number(n).toLocaleString("en-GB", {
    maximumFractionDigits: 2,
  });

export default function App() {
  const [models, setModels] = useState({
    status: "loading",
    list: [],
    error: "",
  });

  const [reload, setReload] = useState(0);
  const [model, setModel] = useState("");

  const [cons, setCons] = useState({
    status: "idle",
    data: null,
    error: "",
  });

  const [consReload, setConsReload] = useState(0);

  const [modelInfo, setModelInfo] = useState({
    status: "idle",
    data: null,
    error: "",
  });

  const [infoReload, setInfoReload] = useState(0);

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState({ status: "idle" });

  // Load models
  useEffect(() => {
    const ctl = new AbortController();

    setModels({
      status: "loading",
      list: [],
      error: "",
    });

    api("/models", { signal: ctl.signal })
      .then((list) =>
        setModels({
          status: "ready",
          list,
          error: "",
        })
      )
      .catch(
        (e) =>
          e.name !== "AbortError" &&
          setModels({
            status: "error",
            list: [],
            error: e.message,
          })
      );

    return () => ctl.abort();
  }, [reload]);

  // Load constraints
  useEffect(() => {
    if (!model) return;

    const ctl = new AbortController();

    setCons({
      status: "loading",
      data: null,
      error: "",
    });

    setErrors({});

    api(`/models/${encodeURIComponent(model)}/constraints`, {
      signal: ctl.signal,
    })
      .then((data) => {
        setCons({
          status: "ready",
          data,
          error: "",
        });

        setValues({
          transmission: data.transmission?.[0] ?? "",
          fuelType: data.fuelType?.[0] ?? "",
        });
      })
      .catch(
        (e) =>
          e.name !== "AbortError" &&
          setCons({
            status: "error",
            data: null,
            error: e.message,
          })
      );

    return () => ctl.abort();
  }, [model, consReload]);

  // Load model information
  useEffect(() => {
    if (!model) return;

    const ctl = new AbortController();

    setModelInfo({
      status: "loading",
      data: null,
      error: "",
    });

    api(`/model_info/${encodeURIComponent(model)}`, {
      signal: ctl.signal,
    })
      .then((data) =>
        setModelInfo({
          status: "ready",
          data,
          error: "",
        })
      )
      .catch(
        (e) =>
          e.name !== "AbortError" &&
          setModelInfo({
            status: "error",
            data: null,
            error: e.message,
          })
      );

    return () => ctl.abort();
  }, [model, infoReload]);

  const pickModel = (m) => {
    setModel(m);
    setResult({ status: "idle" });
    setErrors({});

    if (!m) {
      setCons({
        status: "idle",
        data: null,
        error: "",
      });

      setModelInfo({
        status: "idle",
        data: null,
        error: "",
      });

      setValues({});
    } else {
      setModelInfo({
        status: "loading",
        data: null,
        error: "",
      });
    }
  };

  const setField = (key, value) => {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (errors[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: undefined,
      }));
    }
  };

  const validate = () => {
    const out = {};

    if (!cons.data) return out;

    for (const field of NUMERIC) {
      const raw = (values[field.key] ?? "").toString().trim();

      const [min, max] = cons.data[field.key];

      const number = Number(raw);

      if (raw === "") {
        out[field.key] = "Required";
      } else if (!Number.isFinite(number)) {
        out[field.key] = "Enter a valid number";
      } else if (field.int && !Number.isInteger(number)) {
        out[field.key] = "Use a whole number";
      } else if (number < min || number > max) {
        out[field.key] = `${fmt(min)} – ${fmt(max)}`;
      }
    }

    for (const key of ["transmission", "fuelType"]) {
      if (!cons.data[key]?.includes(values[key])) {
        out[key] = "Choose an option";
      }
    }

    return out;
  };

  const submit = async (e) => {
    e.preventDefault();

    if (cons.status !== "ready") return;

    const errs = validate();

    setErrors(errs);

    const bad = Object.keys(errs).filter((key) => errs[key]);

    if (bad.length) {
      document.getElementById("f-" + bad[0])?.focus();
      return;
    }

    setResult({
      status: "loading",
    });

    try {
      const data = await api("/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          car_model: model,
          year: Number(values.year),
          transmission: values.transmission,
          mileage: Number(values.mileage),
          fuelType: values.fuelType,
          tax: Number(values.tax),
          mpg: Number(values.mpg),
          engineSize: Number(values.engineSize),
        }),
      });

      setResult({
        status: "done",
        data,
      });
    } catch (err) {
      const hint =
        err.status === 502
          ? " The price model ran, but the vehicle-info lookup failed. Check GROQ_API_KEY in Backend/.env."
          : "";

      setResult({
        status: "error",
        message: err.message + hint,
      });
    }
  };

  return (
    <>
      <style>{`
  * {
    box-sizing: border-box;
  }

  :root {
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;

    color: #151515;
    background: #f4f2ed;
    font-synthesis: none;
  }

  body {
    margin: 0;
    background: #f4f2ed;
  }

  button,
  input,
  select {
    font: inherit;
  }

  button,
  select {
    cursor: pointer;
  }

  /* ================================
     APP
  ================================ */

  .app {
    min-height: 100vh;
    background: #f4f2ed;
  }

  /* ================================
     HEADER
  ================================ */

  .topbar {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
    height: 82px;

    display: flex;
    align-items: center;
    justify-content: space-between;

    border-bottom: 2px solid #d8d5cd;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 13px;

    color: #171717;
    text-decoration: none;

    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  .brand-mark {
    width: 38px;
    height: 38px;

    display: grid;
    place-items: center;

    background: #161616;
    color: white;

    font-size: 15px;
    font-weight: 900;
  }

  .topbar-note {
    color: #5f5b54;

    font-size: 13px;
    font-weight: 800;

    letter-spacing: 0.08em;
  }

  /* ================================
     HERO
  ================================ */

  .hero {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;

    padding: 88px 0 62px;

    display: grid;
    grid-template-columns: 1.4fr 0.6fr;
    gap: 60px;

    border-bottom: 2px solid #d8d5cd;
  }

  .eyebrow {
    margin: 0 0 20px;

    color: #85572f;

    font-size: 14px;
    font-weight: 900;

    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .hero h1 {
    max-width: 800px;
    margin: 0;

    font-size: clamp(52px, 6vw, 82px);
    line-height: 0.94;

    letter-spacing: -0.065em;
    font-weight: 750;
  }

  .hero-copy {
    align-self: end;

    max-width: 390px;
    margin: 0 0 7px;

    color: #55514b;

    font-size: 18px;
    line-height: 1.65;
    font-weight: 600;
  }

  /* ================================
     MAIN
  ================================ */

  .content {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;

    padding: 58px 0 90px;

    display: grid;
    grid-template-columns:
      minmax(0, 1.15fr)
      minmax(360px, 0.85fr);

    gap: 26px;

    align-items: start;
  }

  .panel {
    background: #fff;

    border: 2px solid #d8d5cd;
  }

  /* ================================
     FORM PANEL
  ================================ */

  .form-panel {
    padding: 38px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    align-items: flex-start;

    padding-bottom: 30px;
    margin-bottom: 32px;

    border-bottom: 2px solid #e2dfd7;
  }

  .panel-header h2 {
    margin: 5px 0 0;

    font-size: 30px;
    line-height: 1.1;

    letter-spacing: -0.04em;
    font-weight: 750;
  }

  .panel-number {
    color: #68645d;

    font-size: 14px;
    font-weight: 800;
  }

  /* ================================
     FORM FIELDS
  ================================ */

  .field {
    margin-bottom: 27px;
  }

  .field label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;

    margin-bottom: 10px;

    color: #282622;

    font-size: 15px;
    font-weight: 800;

    letter-spacing: -0.01em;
  }

  .field-range {
    color: #77726a;

    font-size: 13px;
    font-weight: 700;
  }

  input,
  select {
    width: 100%;
    height: 55px;

    padding: 0 16px;

    border: 2px solid #d1cdc4;
    border-radius: 0;

    background: #faf9f6;
    color: #171717;

    outline: none;

    font-size: 16px;
    font-weight: 650;

    transition:
      border-color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  }

  input:hover,
  select:hover {
    border-color: #969188;
  }

  input:focus,
  select:focus {
    border-color: #171717;

    background: #fff;

    box-shadow:
      0 0 0 3px rgba(23, 23, 23, 0.08);
  }

  input::placeholder {
    color: #89847b;
    font-weight: 600;
  }

  .input-with-unit {
    position: relative;
  }

  .input-with-unit input {
    padding-right: 105px;
  }

  .unit {
    position: absolute;

    top: 50%;
    right: 15px;

    transform: translateY(-50%);

    color: #77726a;

    font-size: 13px;
    font-weight: 800;

    pointer-events: none;
  }

  .two-columns {
    display: grid;

    grid-template-columns: 1fr 1fr;

    gap: 16px;
  }

  .numeric-grid {
    display: grid;

    grid-template-columns: 1fr 1fr;

    gap: 0 16px;
  }

  /* ================================
     SUPPORTING TEXT
  ================================ */

  .hint {
    margin: 8px 0 0;

    color: #77726e;

    font-size: 13px;
    line-height: 1.5;

    font-weight: 650;
  }

  .error-text {
    margin: 8px 0 0;

    color: #9a3e2d;

    font-size: 13px;
    line-height: 1.5;

    font-weight: 800;
  }

  /* ================================
     BUTTON
  ================================ */

  .submit-button {
    width: 100%;
    height: 60px;

    margin-top: 10px;

    border: 0;
    border-radius: 0;

    background: #171717;
    color: white;

    font-size: 16px;
    font-weight: 850;

    letter-spacing: 0.01em;

    transition:
      background 150ms ease,
      transform 150ms ease;
  }

  .submit-button:hover:not(:disabled) {
    background: #353535;

    transform: translateY(-1px);
  }

  .submit-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-button:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  /* ================================
     EMPTY STATE
  ================================ */

  .empty-state {
    padding: 22px;

    border: 2px dashed #cbc7be;

    color: #68645d;
    background: #faf9f6;

    font-size: 14px;
    line-height: 1.65;

    font-weight: 650;
  }

  .empty-state strong {
    color: #222;
    font-weight: 850;
  }

  /* ================================
     RESULT
  ================================ */

  .result-panel {
    position: sticky;
    top: 24px;

    overflow: hidden;
  }

  .result-top {
    padding: 38px;

    min-height: 330px;

    background: #191919;
    color: white;

    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .result-label {
    display: flex;
    justify-content: space-between;
    align-items: center;

    color: #c0bdb7;

    font-size: 13px;
    font-weight: 850;

    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .result-model {
    color: #e0ddd6;

    font-size: 14px;

    text-transform: none;
    letter-spacing: 0;

    font-weight: 750;
  }

  .price {
    margin: 48px 0 8px;

    font-size: clamp(54px, 5vw, 76px);

    line-height: 0.95;

    letter-spacing: -0.06em;

    font-weight: 750;
  }

  .price-placeholder {
    color: #666;
  }

  .result-caption {
    margin: 0;

    color: #b0ada7;

    font-size: 14px;
    line-height: 1.5;

    font-weight: 650;
  }

  /* ================================
     RESULT INFORMATION
  ================================ */

  .result-body {
    padding: 32px 38px;

    background: #fff;
  }

  .result-body h3 {
    margin: 0 0 23px;

    color: #25231f;

    font-size: 17px;
    font-weight: 850;

    letter-spacing: -0.02em;
  }

  .spec-list {
    margin: 0;
    padding: 0;

    display: grid;
  }

  .spec-row {
    display: grid;

    grid-template-columns:
      1fr
      1.4fr;

    gap: 20px;

    padding: 16px 0;

    border-top: 2px solid #e8e5df;
  }

  .spec-row dt {
    color: #77726b;

    font-size: 13px;
    font-weight: 750;
  }

  .spec-row dd {
    margin: 0;

    color: #282622;

    font-size: 14px;
    line-height: 1.5;

    font-weight: 800;
  }

  .summary {
    margin: 25px 0 0;
    padding-top: 21px;

    border-top: 2px solid #e8e5df;

    color: #55514b;

    font-size: 14px;
    line-height: 1.75;

    font-weight: 600;
  }

  /* ================================
     ALERT
  ================================ */

  .alert {
    padding: 19px;

    border-left: 4px solid #9b4634;

    background: #f8efeb;

    color: #71392d;

    font-size: 14px;
    line-height: 1.65;

    font-weight: 650;
  }

  .alert p {
    margin: 0 0 10px;
  }

  .alert p:last-child {
    margin-bottom: 0;
  }

  .retry {
    margin-top: 12px;

    height: 39px;

    padding: 0 15px;

    border: 2px solid #bba89f;

    background: transparent;

    color: #71392d;

    font-size: 13px;
    font-weight: 850;
  }

  /* ================================
     SKELETON
  ================================ */

  .skeleton {
    height: 14px;

    width: 100%;

    margin-bottom: 11px;

    background: #333;

    animation: pulse 1.4s ease-in-out infinite;
  }

  .skeleton.large {
    width: 75%;
    height: 68px;

    margin-top: 45px;
  }

  .skeleton.short {
    width: 45%;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.35;
    }

    50% {
      opacity: 0.7;
    }
  }

  /* ================================
     FOOTER
  ================================ */

  .footer {
    width: min(1180px, calc(100% - 48px));

    margin: 0 auto;

    padding: 28px 0 40px;

    border-top: 2px solid #d8d5cd;

    display: flex;

    justify-content: space-between;

    gap: 30px;

    align-items: center;
  }

  .footer-copy {
    margin: 0;

    color: #68645d;

    font-size: 13px;
    line-height: 1.65;

    font-weight: 650;
  }

  .footer-links {
    display: flex;

    gap: 25px;
  }

  .footer-links a {
    color: #36332e;

    font-size: 13px;

    font-weight: 850;

    text-decoration: none;
  }

  .footer-links a:hover {
    color: #000;
  }

  /* ================================
     MOBILE
  ================================ */

  @media (max-width: 850px) {
    .hero {
      grid-template-columns: 1fr;

      gap: 28px;

      padding: 62px 0 46px;
    }

    .hero-copy {
      max-width: 550px;
    }

    .content {
      grid-template-columns: 1fr;
    }

    .result-panel {
      position: static;
    }
  }

  @media (max-width: 600px) {
    .topbar,
    .hero,
    .content,
    .footer {
      width: min(100% - 30px, 1180px);
    }

    .topbar {
      height: 70px;
    }

    .topbar-note {
      display: none;
    }

    .hero {
      padding: 52px 0 40px;
    }

    .hero h1 {
      font-size: 49px;
    }

    .hero-copy {
      font-size: 16px;
    }

    .content {
      padding-top: 30px;
    }

    .form-panel,
    .result-top,
    .result-body {
      padding: 25px;
    }

    .numeric-grid,
    .two-columns {
      grid-template-columns: 1fr;
    }

    .panel-header h2 {
      font-size: 26px;
    }

    .field label {
      font-size: 15px;
    }

    input,
    select {
      height: 53px;
      font-size: 15px;
    }

    .footer {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`}</style>

      <div className="app">

        {/* HEADER */}

        <header className="topbar">
          <a className="brand" href="/">
            <span className="brand-mark">F</span>
            <span>Ford Valuation</span>
          </a>

          <span className="topbar-note">
            USED CAR PRICE ESTIMATOR
          </span>
        </header>

        {/* HERO */}

        <section className="hero">
          <div>
            <p className="eyebrow">
              Machine learning · Used Ford
            </p>

            <h1>
              Know what your
              <br />
              Ford is worth.
            </h1>
          </div>

          <p className="hero-copy">
            Enter the details of a vehicle and get an estimated resale
            value based on a trained regression model.
          </p>
        </section>

        {/* MAIN */}

        <main className="content">

          {/* FORM */}

          <section className="panel form-panel">

            <div className="panel-header">
              <div>
                <p className="eyebrow">01 / Vehicle</p>

                <h2>
                  Tell us about the car
                </h2>
              </div>

              <span className="panel-number">
                {model ? pretty(model) : "—"}
              </span>
            </div>

            {/* MODEL */}

            <div className="field">
              <label htmlFor="f-model">
                <span>Model</span>
              </label>

              {models.status === "error" ? (
                <div className="alert">
                  <p>{models.error}</p>

                  <button
                    type="button"
                    className="retry"
                    onClick={() => setReload((n) => n + 1)}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <select
                  id="f-model"
                  value={model}
                  disabled={models.status === "loading"}
                  onChange={(e) => pickModel(e.target.value)}
                >
                  <option value="">
                    {models.status === "loading"
                      ? "Loading models..."
                      : "Select a Ford model"}
                  </option>

                  {models.list.map((m) => (
                    <option key={m} value={m}>
                      {pretty(m)}
                    </option>
                  ))}
                </select>
              )}

              {models.status === "ready" &&
                models.list.length === 0 && (
                  <p className="hint">
                    The API returned no available models.
                  </p>
                )}
            </div>

            {!model && models.status !== "error" && (
              <div className="empty-state">
                Select a model to unlock the vehicle details and
                supported value ranges.
              </div>
            )}

            {cons.status === "loading" && (
              <div className="empty-state">
                Loading supported values for{" "}
                <strong>{pretty(model)}</strong>...
              </div>
            )}

            {cons.status === "error" && (
              <div className="alert">
                <p>{cons.error}</p>

                <button
                  type="button"
                  className="retry"
                  onClick={() =>
                    setConsReload((n) => n + 1)
                  }
                >
                  Try again
                </button>
              </div>
            )}

            {cons.status === "ready" && (
              <form onSubmit={submit} noValidate>

                {/* SELECTS */}

                <div className="two-columns">

                  {[
                    ["transmission", "Transmission"],
                    ["fuelType", "Fuel type"],
                  ].map(([key, label]) => (
                    <div className="field" key={key}>

                      <label htmlFor={`f-${key}`}>
                        <span>{label}</span>
                      </label>

                      <select
                        id={`f-${key}`}
                        value={values[key] ?? ""}
                        aria-invalid={!!errors[key]}
                        onChange={(e) =>
                          setField(key, e.target.value)
                        }
                      >
                        {cons.data[key].map((option) => (
                          <option
                            key={option}
                            value={option}
                          >
                            {pretty(option)}
                          </option>
                        ))}
                      </select>

                      {errors[key] && (
                        <p className="error-text">
                          {errors[key]}
                        </p>
                      )}

                    </div>
                  ))}

                </div>

                {/* NUMERIC FIELDS */}

                <div className="numeric-grid">

                  {NUMERIC.map((field) => {
                    const [min, max] =
                      cons.data[field.key];

                    return (
                      <div
                        className="field"
                        key={field.key}
                      >
                        <label htmlFor={`f-${field.key}`}>

                          <span>
                            {field.label}
                          </span>

                          <span className="field-range">
                            {fmt(min)} – {fmt(max)}
                          </span>

                        </label>

                        <div className="input-with-unit">

                          <input
                            id={`f-${field.key}`}
                            type="number"
                            inputMode={
                              field.int
                                ? "numeric"
                                : "decimal"
                            }
                            min={min}
                            max={max}
                            step={field.step}
                            value={
                              values[field.key] ?? ""
                            }
                            placeholder={fmt(min)}
                            aria-invalid={
                              !!errors[field.key]
                            }
                            onChange={(e) =>
                              setField(
                                field.key,
                                e.target.value
                              )
                            }
                          />

                          {field.unit && (
                            <span className="unit">
                              {field.unit}
                            </span>
                          )}

                        </div>

                        {errors[field.key] ? (
                          <p className="error-text">
                            {errors[field.key]}
                          </p>
                        ) : (
                          <p className="hint">
                            Accepted: {fmt(min)} –{" "}
                            {fmt(max)}
                          </p>
                        )}
                      </div>
                    );
                  })}

                </div>

                <button
                  className="submit-button"
                  type="submit"
                  disabled={result.status === "loading"}
                >
                  {result.status === "loading"
                    ? "Calculating..."
                    : "Estimate vehicle value"}
                </button>

              </form>
            )}

          </section>

          {/* RESULT */}

          <Result
            model={model}
            result={result}
            modelInfo={modelInfo}
            onRetryInfo={() =>
              setInfoReload((n) => n + 1)
            }
          />

        </main>

        {/* FOOTER */}

        <footer className="footer">

          <p className="footer-copy">
            Built around a Random Forest regression model
            and FastAPI service.
            <br />
            Estimates are indicative and not a guaranteed
            market price.
          </p>

          <nav className="footer-links">
            <a
              href={LINKS.github}
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>

            <a
              href={LINKS.repo}
              target="_blank"
              rel="noreferrer"
            >
              Repository
            </a>

            <a
              href={LINKS.linkedin}
              target="_blank"
              rel="noreferrer"
            >
              LinkedIn
            </a>
          </nav>

        </footer>

      </div>
    </>
  );
}


/* =========================================================
   RESULT COMPONENT
========================================================= */

function Result({
  model,
  result,
  modelInfo,
  onRetryInfo,
}) {
  const info =
    modelInfo.status === "ready"
      ? modelInfo.data || {}
      : {};

  const start = info.production_start_year;
  const end = info.production_end_year;

  const list = (array) =>
    Array.isArray(array) && array.length
      ? array.map(pretty).join(", ")
      : null;

  return (
    <section
      className="panel result-panel"
      aria-live="polite"
      aria-label="Estimated vehicle value"
    >

      {/* PRICE */}

      <div className="result-top">

        <div className="result-label">
          <span>Estimated value using ML model</span>

          {model && (
            <span className="result-model">
              {pretty(model)}
            </span>
          )}
        </div>

        {result.status === "idle" && (
          <div>
            <p className="price price-placeholder">
              £—
            </p>

            <p className="result-caption">
              Complete the vehicle details to calculate
              an estimate.
            </p>
          </div>
        )}

        {result.status === "loading" && (
          <div aria-busy="true">
            <div className="skeleton large" />
            <div className="skeleton" />
            <div className="skeleton short" />
          </div>
        )}

        {result.status === "error" && (
          <div className="alert">
            <p>{result.message}</p>

            <p>
              Your inputs have been kept. Adjust them
              or submit again.
            </p>
          </div>
        )}

        {result.status === "done" && (
          <div>
            <p className="price">
              {gbp(result.data.predicted_price)}
            </p>

            <p className="result-caption">
              Estimated resale price
            </p>
          </div>
        )}

      </div>

      {/* MODEL INFORMATION */}

      {model && (
        <div className="result-body">

          {modelInfo.status === "loading" && (
            <>
              <h3>Vehicle information</h3>

              <div
                className="skeleton"
                style={{
                  background: "#e8e5df",
                }}
              />

              <div
                className="skeleton short"
                style={{
                  background: "#e8e5df",
                }}
              />
            </>
          )}

          {modelInfo.status === "error" && (
            <div className="alert">
              <p>
                Could not load information for{" "}
                {pretty(model)}.
              </p>

              <p>{modelInfo.error}</p>

              <button
                type="button"
                className="retry"
                onClick={onRetryInfo}
              >
                Try again
              </button>
            </div>
          )}

          {modelInfo.status === "ready" && (
            <>
              <h3>About this model</h3>

              <dl className="spec-list">

                {start != null && (
                  <div className="spec-row">
                    <dt>Production</dt>

                    <dd>
                      {start} – {end ?? "present"}
                    </dd>
                  </div>
                )}

                {list(info.transmissions) && (
                  <div className="spec-row">
                    <dt>Transmission</dt>

                    <dd>
                      {list(info.transmissions)}
                    </dd>
                  </div>
                )}

                {list(info.fuel_types) && (
                  <div className="spec-row">
                    <dt>Fuel</dt>

                    <dd>
                      {list(info.fuel_types)}
                    </dd>
                  </div>
                )}

              </dl>

              {info.summary && (
                <p className="summary">
                  {info.summary}
                </p>
              )}
            </>
          )}

        </div>
      )}

    </section>
  );
}