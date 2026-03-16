"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type PropertyStatus = "Lista para llegar" | "Con observaciones" | "En mantencion";

type OwnerRecord = {
  id: string;
  name: string;
  email: string;
};

type OwnerForm = {
  name: string;
  email: string;
};

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

type PropertyRecord = PropertyForm & {
  id: string;
  ownerId: string;
};

const initialOwnerForm: OwnerForm = {
  name: "",
  email: "",
};

const initialPropertyForm: PropertyForm = {
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

function normalizeEmail(value: string) {
  return value.toLowerCase().trim();
}

export default function Home() {
  const modalBackdropStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(20, 17, 24, 0.42)",
    display: "grid",
    placeItems: "center",
    padding: 16,
    zIndex: 9999,
  };

  const modalCardStyle: CSSProperties = {
    width: "min(520px, 100%)",
    background: "#fff",
    border: "1px solid #f1d6d6",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 20px 42px rgba(17, 12, 46, 0.25)",
  };

  const [owners, setOwners] = useState<OwnerRecord[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [ownerForm, setOwnerForm] = useState<OwnerForm>(initialOwnerForm);
  const [ownerModalMode, setOwnerModalMode] = useState<"create" | "edit" | null>(null);
  const [editingOwnerId, setEditingOwnerId] = useState<string | null>(null);

  const [properties, setProperties] = useState<PropertyRecord[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [propertyForm, setPropertyForm] = useState<PropertyForm>(initialPropertyForm);
  const [isCreatingProperty, setIsCreatingProperty] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingOwner, setSavingOwner] = useState(false);
  const [savingProperty, setSavingProperty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOwner = useMemo(
    () => owners.find((item) => item.id === selectedOwnerId) ?? null,
    [owners, selectedOwnerId]
  );

  const ownerProperties = useMemo(() => {
    if (!selectedOwnerId) return [];
    return properties.filter((item) => item.ownerId === selectedOwnerId);
  }, [properties, selectedOwnerId]);

  const selectedProperty = useMemo(
    () => ownerProperties.find((item) => item.id === selectedPropertyId) ?? null,
    [ownerProperties, selectedPropertyId]
  );

  const ownerPropertyCount = useMemo(() => {
    const countMap = new Map<string, number>();
    properties.forEach((item) => {
      countMap.set(item.ownerId, (countMap.get(item.ownerId) ?? 0) + 1);
    });
    return countMap;
  }, [properties]);

  const showPropertyEditor = isCreatingProperty || Boolean(selectedPropertyId);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const ownerSnap = await getDocs(collection(db, "owners"));
      const ownerRows = ownerSnap.docs
        .map((item) => {
          const raw = item.data() as Partial<OwnerRecord>;
          return {
            id: item.id,
            name: raw.name ?? "",
            email: normalizeEmail(raw.email ?? ""),
          };
        })
        .filter((item) => item.email.length > 0 && item.id === item.email);

      ownerRows.sort((a, b) => a.name.localeCompare(b.name, "es-CL"));
      setOwners(ownerRows);

      const propertyRows: PropertyRecord[] = [];
      for (const owner of ownerRows) {
        const propSnap = await getDocs(collection(db, `owners/${owner.id}/properties`));
        propSnap.docs.forEach((item) => {
          const raw = item.data() as Partial<PropertyForm>;
          propertyRows.push({
            id: item.id,
            ownerId: owner.id,
            name: raw.name ?? "",
            location: raw.location ?? "",
            status: (raw.status as PropertyStatus) ?? "Con observaciones",
            readiness: raw.readiness ? String(raw.readiness) : "0",
            temperature: raw.temperature ?? "",
            nextArrival: raw.nextArrival ?? "",
            summary: raw.summary ?? "",
            hero: raw.hero ?? "",
          });
        });
      }

      propertyRows.sort((a, b) => a.name.localeCompare(b.name, "es-CL"));
      setProperties(propertyRows);
    } catch (loadErr) {
      console.error(loadErr);
      setError("No se pudieron cargar owners/propiedades desde Firestore.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (owners.length === 0) {
      setSelectedOwnerId(null);
      return;
    }

    const selectedExists = selectedOwnerId ? owners.some((item) => item.id === selectedOwnerId) : false;
    if (!selectedExists) {
      setSelectedOwnerId(owners[0].id);
    }
  }, [owners, selectedOwnerId]);

  useEffect(() => {
    if (!selectedOwner) return;
    setSelectedPropertyId(null);
    setIsCreatingProperty(false);
    setPropertyForm(initialPropertyForm);
  }, [selectedOwner]);

  useEffect(() => {
    if (!selectedProperty) return;
    setPropertyForm({
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

  const openCreateOwnerModal = () => {
    setOwnerForm(initialOwnerForm);
    setEditingOwnerId(null);
    setOwnerModalMode("create");
    setError(null);
    setMessage(null);
  };

  const openEditOwnerModal = (owner: OwnerRecord) => {
    setOwnerForm({ name: owner.name, email: owner.email });
    setEditingOwnerId(owner.id);
    setOwnerModalMode("edit");
    setError(null);
    setMessage(null);
  };

  const closeOwnerModal = () => {
    if (savingOwner) return;
    setOwnerModalMode(null);
    setEditingOwnerId(null);
  };

  const handleSelectOwner = (ownerId: string) => {
    setSelectedOwnerId(ownerId);
    setSelectedPropertyId(null);
    setIsCreatingProperty(false);
    setMessage(null);
    setError(null);
  };

  const handleOwnerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingOwner(true);
    setError(null);
    setMessage(null);

    const normalizedName = ownerForm.name.trim();
    const normalizedEmail = normalizeEmail(ownerForm.email);

    if (!normalizedName || !normalizedEmail) {
      setSavingOwner(false);
      setError("Nombre y email de owner son obligatorios.");
      return;
    }

    try {
      if (ownerModalMode === "edit" && editingOwnerId) {
        if (editingOwnerId !== normalizedEmail) {
          setError("Para cambiar email de owner debes crear uno nuevo y migrar propiedades.");
          setSavingOwner(false);
          return;
        }

        await updateDoc(doc(db, "owners", editingOwnerId), {
          name: normalizedName,
          email: normalizedEmail,
        });
        setMessage("Owner actualizado correctamente.");
      } else {
        const id = normalizedEmail;
        await setDoc(doc(db, "owners", id), {
          name: normalizedName,
          email: normalizedEmail,
        }, { merge: true });
        setSelectedOwnerId(id);
        setMessage("Owner creado correctamente.");
      }

      await loadData();
      closeOwnerModal();
    } catch (saveErr) {
      console.error(saveErr);
      setError("No se pudo guardar el owner. Revisa reglas y conexion.");
    } finally {
      setSavingOwner(false);
    }
  };

  const handleNewProperty = () => {
    if (!selectedOwnerId) {
      setError("Primero selecciona un owner para crear la propiedad.");
      return;
    }

    setSelectedPropertyId(null);
    setIsCreatingProperty(true);
    setPropertyForm(initialPropertyForm);
    setMessage(null);
    setError(null);
  };

  const handleSelectProperty = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setIsCreatingProperty(false);
    setMessage(null);
    setError(null);
  };

  const handlePropertySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingProperty(true);
    setError(null);
    setMessage(null);

    if (!selectedOwnerId) {
      setSavingProperty(false);
      setError("Debes seleccionar un owner.");
      return;
    }

    const normalizedName = propertyForm.name.trim();
    const normalizedLocation = propertyForm.location.trim();

    if (!normalizedName || !normalizedLocation) {
      setSavingProperty(false);
      setError("Nombre y ubicacion son obligatorios.");
      return;
    }

    const payload = {
      name: normalizedName,
      location: normalizedLocation,
      status: propertyForm.status,
      readiness: Number(propertyForm.readiness) || 0,
      summary: propertyForm.summary.trim(),
      hero: propertyForm.hero.trim(),
      nextArrival: propertyForm.nextArrival.trim(),
      temperature: propertyForm.temperature.trim(),
    };

    try {
      if (selectedPropertyId) {
        await updateDoc(doc(db, `owners/${selectedOwnerId}/properties/${selectedPropertyId}`), payload);
        setMessage("Propiedad actualizada correctamente.");
      } else {
        const base = toSlug(normalizedName) || "propiedad";
        const id = `${base}-${Date.now().toString().slice(-6)}`;
        await setDoc(doc(db, `owners/${selectedOwnerId}/properties/${id}`), payload);
        setSelectedPropertyId(id);
        setIsCreatingProperty(false);
        setMessage("Propiedad creada correctamente.");
      }

      await loadData();
    } catch (saveErr) {
      console.error(saveErr);
      setError("No se pudo guardar la propiedad. Revisa reglas y conexion.");
    } finally {
      setSavingProperty(false);
    }
  };

  return (
    <div className="admin-shell">
      <header className="hero">
        <p className="kicker">Andes Estate</p>
        <h1>Panel de Administracion</h1>
        <p className="subtitle">Flujo principal: Owners, propiedades del owner y detalle de propiedad.</p>
      </header>

      <main className="layout">
        <section className="card">
          <div className="card-header">
            <h2>1. Owners</h2>
            <button className="ghost-btn" type="button" onClick={openCreateOwnerModal}>
              Agregar owner
            </button>
          </div>

          {loading ? <p className="muted">Cargando owners...</p> : null}

          <ul className="property-list">
            {owners.map((item) => {
              const selected = item.id === selectedOwnerId;
              return (
                <li key={item.id}>
                  <div className="owner-row">
                    <button
                      type="button"
                      className={`property-item ${selected ? "is-selected" : ""}`}
                      onClick={() => handleSelectOwner(item.id)}
                    >
                      <p className="property-title">{item.name || "Sin nombre"}</p>
                      <p className="property-location">{item.email || "Sin email"}</p>
                      <p className="property-meta">Propiedades: {ownerPropertyCount.get(item.id) ?? 0}</p>
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Editar owner"
                      aria-label={`Editar owner ${item.name}`}
                      onClick={() => openEditOwnerModal(item)}
                    >
                      ✎
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>2. Propiedades del owner</h2>
            <button className="ghost-btn" type="button" onClick={handleNewProperty}>
              Nueva propiedad
            </button>
          </div>

          {selectedOwner ? (
            <p className="muted" style={{ marginBottom: 10 }}>
              Owner activo: <strong>{selectedOwner.name}</strong>
            </p>
          ) : (
            <p className="muted">Selecciona un owner para ver sus propiedades.</p>
          )}

          <ul className="property-list">
            {ownerProperties.map((item) => {
              const selected = item.id === selectedPropertyId;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`property-item ${selected ? "is-selected" : ""}`}
                    onClick={() => handleSelectProperty(item.id)}
                  >
                    <p className="property-title">{item.name || "Sin nombre"}</p>
                    <p className="property-location">{item.location || "Sin ubicacion"}</p>
                    <p className="property-meta">Estado: {item.status}</p>
                  </button>
                </li>
              );
            })}
          </ul>

          {selectedOwner && ownerProperties.length === 0 ? (
            <p className="muted" style={{ marginTop: 10 }}>
              Este owner aun no tiene propiedades.
            </p>
          ) : null}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>3. Detalle de propiedad</h2>
            <span className="chip">
              {selectedPropertyId ? "Edicion" : isCreatingProperty ? "Creacion" : "Sin seleccion"}
            </span>
          </div>

          {!selectedOwner ? <p className="muted">Selecciona un owner para continuar.</p> : null}
          {selectedOwner && !showPropertyEditor ? (
            <p className="muted">Selecciona una propiedad del owner o crea una nueva.</p>
          ) : null}

          {selectedOwner && showPropertyEditor ? (
            <form className="property-form" onSubmit={handlePropertySubmit}>
              <label>
                Nombre
                <input
                  value={propertyForm.name}
                  onChange={(event) => setPropertyForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Casa Cachagua"
                />
              </label>

              <label>
                Ubicacion
                <input
                  value={propertyForm.location}
                  onChange={(event) => setPropertyForm((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="Cachagua, Chile"
                />
              </label>

              <label>
                Estado
                <select
                  value={propertyForm.status}
                  onChange={(event) =>
                    setPropertyForm((prev) => ({ ...prev, status: event.target.value as PropertyStatus }))
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
                  value={propertyForm.readiness}
                  onChange={(event) => setPropertyForm((prev) => ({ ...prev, readiness: event.target.value }))}
                />
              </label>

              <label>
                Temperatura
                <input
                  value={propertyForm.temperature}
                  onChange={(event) => setPropertyForm((prev) => ({ ...prev, temperature: event.target.value }))}
                  placeholder="20 C"
                />
              </label>

              <label>
                Proxima llegada
                <input
                  value={propertyForm.nextArrival}
                  onChange={(event) => setPropertyForm((prev) => ({ ...prev, nextArrival: event.target.value }))}
                  placeholder="21 Mar 2026"
                />
              </label>

              <label>
                Resumen
                <textarea
                  rows={3}
                  value={propertyForm.summary}
                  onChange={(event) => setPropertyForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="Casa preparada, personal coordinado y mantenciones revisadas."
                />
              </label>

              <label>
                URL imagen principal
                <input
                  value={propertyForm.hero}
                  onChange={(event) => setPropertyForm((prev) => ({ ...prev, hero: event.target.value }))}
                  placeholder="https://..."
                />
              </label>

              <button className="primary-btn" type="submit" disabled={savingProperty}>
                {savingProperty ? "Guardando..." : selectedPropertyId ? "Guardar cambios" : "Crear propiedad"}
              </button>
            </form>
          ) : null}

          {error ? <p className="error" style={{ marginTop: 10 }}>{error}</p> : null}
          {message ? <p className="success" style={{ marginTop: 10 }}>{message}</p> : null}
        </section>
      </main>

      {ownerModalMode ? (
        <div className="modal-backdrop" style={modalBackdropStyle} onClick={closeOwnerModal}>
          <div className="modal-card" style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <h3>{ownerModalMode === "create" ? "Crear owner" : "Editar owner"}</h3>
            <form className="property-form" onSubmit={handleOwnerSubmit}>
              <label>
                Nombre owner
                <input
                  value={ownerForm.name}
                  onChange={(event) => setOwnerForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Fernando Saavedra"
                />
              </label>
              <label>
                Email owner
                <input
                  type="email"
                  value={ownerForm.email}
                  onChange={(event) => setOwnerForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="owner@correo.com"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={closeOwnerModal}>
                  Cancelar
                </button>
                <button className="primary-btn" type="submit" disabled={savingOwner}>
                  {savingOwner ? "Guardando..." : ownerModalMode === "create" ? "Crear owner" : "Guardar owner"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
