"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type PropertyStatus = "Lista para llegar" | "Con observaciones" | "En mantencion";

type PropertyForm = {
  name: string;
  location: string;
  status: PropertyStatus;
  readiness: string;
  temperature: string;
  nextArrival: string;
  summary: string;
  hero: string;
};

type PropertyRecord = PropertyForm & { id: string };

const initialForm: PropertyForm = {
  name: "",
  location: "",
  status: "Lista para llegar",
  readiness: "100",
  temperature: "20 C",
  nextArrival: "",
  summary: "",
  hero: "",
};

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Home() {
  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<PropertyForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProperty = useMemo(
    () => properties.find((item) => item.id === selectedId) ?? null,
    [properties, selectedId]
  );

  const loadProperties = async () => {
    setLoading(true);
    setError(null);

    try {
      const snap = await getDocs(collection(db, "properties"));
      const rows = snap.docs.map((item) => {
        const raw = item.data() as Partial<PropertyForm>;
        return {
          id: item.id,
          name: raw.name ?? "",
          location: raw.location ?? "",
          status: (raw.status as PropertyStatus) ?? "Con observaciones",
          readiness: raw.readiness ? String(raw.readiness) : "0",
          temperature: raw.temperature ?? "",
          nextArrival: raw.nextArrival ?? "",
          summary: raw.summary ?? "",
          hero: raw.hero ?? "",
        };
      });

      rows.sort((a, b) => a.name.localeCompare(b.name, "es-CL"));
      setProperties(rows);
    } catch (loadErr) {
      console.error(loadErr);
      setError("No se pudieron cargar las propiedades desde Firestore.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedProperty) return;
    setForm({
      name: selectedProperty.name,
      location: selectedProperty.location,
      status: selectedProperty.status,
      readiness: selectedProperty.readiness,
      temperature: selectedProperty.temperature,
      nextArrival: selectedProperty.nextArrival,
      summary: selectedProperty.summary,
      hero: selectedProperty.hero,
    });
  }, [selectedProperty]);

  const handleCreateNew = () => {
    setSelectedId(null);
    setForm(initialForm);
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const normalizedName = form.name.trim();
    const normalizedLocation = form.location.trim();

    if (!normalizedName || !normalizedLocation) {
      setSaving(false);
      setError("Nombre y ubicación son obligatorios.");
      return;
    }

    const payload = {
      ...form,
      name: normalizedName,
      location: normalizedLocation,
      readiness: Number(form.readiness) || 0,
      summary: form.summary.trim(),
      hero: form.hero.trim(),
      nextArrival: form.nextArrival.trim(),
      temperature: form.temperature.trim(),
    };

    try {
      if (selectedId) {
        await updateDoc(doc(db, "properties", selectedId), payload);
        setMessage("Propiedad actualizada correctamente.");
      } else {
        const base = toSlug(normalizedName) || "propiedad";
        const id = `${base}-${Date.now().toString().slice(-6)}`;
        await setDoc(doc(db, "properties", id), payload);
        setSelectedId(id);
        setMessage("Propiedad creada correctamente.");
      }

      await loadProperties();
    } catch (saveErr) {
      console.error(saveErr);
      setError("No se pudo guardar. Revisa reglas de Firestore y conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-shell">
      <header className="hero">
        <p className="kicker">Andes Estate</p>
        <h1>Panel de Administracion</h1>
        <p className="subtitle">Crea y mantiene propiedades para distintos propietarios.</p>
      </header>

      <main className="layout">
        <section className="card">
          <div className="card-header">
            <h2>Propiedades</h2>
            <button className="ghost-btn" type="button" onClick={handleCreateNew}>
              Nueva propiedad
            </button>
          </div>

          {loading ? <p className="muted">Cargando propiedades...</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <ul className="property-list">
            {properties.map((item) => {
              const selected = item.id === selectedId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`property-item ${selected ? "is-selected" : ""}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <p className="property-title">{item.name || "Sin nombre"}</p>
                    <p className="property-location">{item.location || "Sin ubicación"}</p>
                    <p className="property-meta">
                      Estado: <strong>{item.status}</strong>
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>{selectedId ? "Editar propiedad" : "Crear propiedad"}</h2>
            <span className="chip">{selectedId ? "Edicion" : "Nueva"}</span>
          </div>

          <form className="property-form" onSubmit={handleSubmit}>
            <label>
              Nombre
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Casa Cachagua"
              />
            </label>

            <label>
              Ubicación
              <input
                value={form.location}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Cachagua, Chile"
              />
            </label>

            <label>
              Estado
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as PropertyStatus }))
                }
              >
                <option value="Lista para llegar">Lista para llegar</option>
                <option value="Con observaciones">Con observaciones</option>
                <option value="En mantencion">En mantencion</option>
              </select>
            </label>

            <label>
              Readiness (%)
              <input
                type="number"
                min={0}
                max={100}
                value={form.readiness}
                onChange={(event) => setForm((prev) => ({ ...prev, readiness: event.target.value }))}
              />
            </label>

            <label>
              Temperatura
              <input
                value={form.temperature}
                onChange={(event) => setForm((prev) => ({ ...prev, temperature: event.target.value }))}
                placeholder="20 C"
              />
            </label>

            <label>
              Próxima llegada
              <input
                value={form.nextArrival}
                onChange={(event) => setForm((prev) => ({ ...prev, nextArrival: event.target.value }))}
                placeholder="21 Mar 2026"
              />
            </label>

            <label>
              Resumen
              <textarea
                rows={3}
                value={form.summary}
                onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder="Casa preparada, personal coordinado y mantenciones revisadas."
              />
            </label>

            <label>
              URL imagen principal
              <input
                value={form.hero}
                onChange={(event) => setForm((prev) => ({ ...prev, hero: event.target.value }))}
                placeholder="https://..."
              />
            </label>

            <button className="primary-btn" type="submit" disabled={saving}>
              {saving ? "Guardando..." : selectedId ? "Guardar cambios" : "Crear propiedad"}
            </button>

            {message ? <p className="success">{message}</p> : null}
          </form>
        </section>
      </main>
    </div>
  );
}
