import React, { useState, useEffect } from "react";

const typeCache = new Map();

export default function ItemDetailCard({ item, onChange }) {
    const [localItem, setLocalItem] = useState(item || {});
    const [resolvedType, setResolvedType] = useState("");

    useEffect(() => {
        setLocalItem(item || {});
    }, [item]);

    // Resolve linked "Type" name from Airtable (optional)
    useEffect(() => {
        const fetchTypeName = async () => {
            if (!item || !item.Type || !Array.isArray(item.Type) || item.Type.length === 0) {
                setResolvedType("-");
                return;
            }
            const typeId = item.Type[0];
            if (typeCache.has(typeId)) {
                setResolvedType(typeCache.get(typeId));
                return;
            }
            setResolvedType("Loading...");
            try {
                const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
                const token = import.meta.env.VITE_AIRTABLE_TOKEN;
                const typesTableId = import.meta.env.VITE_AIRTABLE_TYPES_TABLE_ID;
                if (!typesTableId) throw new Error("VITE_AIRTABLE_TYPES_TABLE_ID is not defined");

                const url = `https://api.airtable.com/v0/${baseId}/${typesTableId}/${typeId}`;
                const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (!res.ok) throw new Error(`Failed to fetch type name. Status: ${res.status}`);
                const record = await res.json();
                const typeName = record.fields["Still Pipe"] || "Unknown Type";
                setResolvedType(typeName);
                typeCache.set(typeId, typeName);
            } catch (error) {
                console.error("Error resolving Type ID:", error);
                setResolvedType(typeId);
            }
        };
        fetchTypeName();
    }, [item]);

    // ✅ Define before return: used by inputs
    const handleFieldChange = (fieldName, value) => {
        const updated = { ...localItem, [fieldName]: value };

        // Keep normalized mirrors in sync for ProcessDiagram/IconManager
        if (fieldName === "Item Code") updated.Code = value;
        if (fieldName === "Code") updated["Item Code"] = value;
        if (fieldName === "Category" || fieldName === "Category Item Type") {
            updated.Category = value;
            updated["Category Item Type"] = value;
        }

        setLocalItem(updated);
        if (onChange) onChange(updated);
    };

    if (!item) return null;

    const getSimpleLinkedValue = (field) => (Array.isArray(field) ? field.join(", ") || "-" : field || "-");

    const categories = ["Equipment", "Instrument", "Inline Valve", "Pipe", "Electrical"];

    // Styles for aligned form
    const rowStyle = { display: "flex", alignItems: "center", marginBottom: "12px" };
    const labelStyle = { width: "130px", fontWeight: 500, color: "#555", textAlign: "right", marginRight: "12px" };
    const inputStyle = {
        flex: 1,
        padding: "6px 10px",
        borderRadius: "6px",
        border: "1px solid #ccc",
        fontSize: "14px",
        outline: "none",
        background: "#fafafa",
    };
    const sectionStyle = { marginBottom: "24px" };
    const headerStyle = { borderBottom: "1px solid #eee", paddingBottom: "6px", marginBottom: "12px", marginTop: 0, color: "#333" };

    return (
        <div
            style={{
                background: "#fff",
                borderRadius: "10px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                padding: "20px",
                margin: "16px",
                maxWidth: "350px",
                fontFamily: "sans-serif",
            }}
        >
            {/* General Info */}
            <section style={sectionStyle}>
                <h3 style={headerStyle}>General Info</h3>

                <div style={rowStyle}>
                    <label style={labelStyle}>Code:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["Item Code"] ?? localItem.Code ?? ""}
                        onChange={(e) => handleFieldChange("Item Code", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Name:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["Name"] || ""}
                        onChange={(e) => handleFieldChange("Name", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Category:</label>
                    <select
                        style={inputStyle}
                        value={localItem["Category Item Type"] ?? localItem.Category ?? "Equipment"}
                        onChange={(e) => handleFieldChange("Category Item Type", e.target.value)}
                    >
                        {categories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                    </select>
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Unit:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["Unit"] || ""}
                        onChange={(e) => handleFieldChange("Unit", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Sub Unit:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["SubUnit"] || localItem["Sub Unit"] || ""}
                        onChange={(e) => handleFieldChange("SubUnit", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Class Name:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["Class Name"] || ""}
                        onChange={(e) => handleFieldChange("Class Name", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Type:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem.Type || ''}
                        onChange={e => handleFieldChange('Type', e.target.value)}
                    />
                </div>


                <div style={rowStyle}>
                    <label style={labelStyle}>Count / Seq:</label>
                    <input
                        style={inputStyle}
                        type="number"
                        value={localItem["Sequence"] || 0}
                        onChange={(e) => handleFieldChange("Sequence", Number(e.target.value))}
                    />
                </div>
            </section>

            {/* Procurement Info */}
            <section style={sectionStyle}>
                <h3 style={headerStyle}>Procurement Info</h3>

                <div style={rowStyle}>
                    <label style={labelStyle}>Model Number:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["Model Number"] || ""}
                        onChange={(e) => handleFieldChange("Model Number", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Manufacturer:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={getSimpleLinkedValue(localItem["Manufacturer (from Technical Spec)"])}
                        onChange={(e) => handleFieldChange("Manufacturer (from Technical Spec)", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Supplier:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={getSimpleLinkedValue(localItem["Supplier (from Technical Spec)"])}
                        onChange={(e) => handleFieldChange("Supplier (from Technical Spec)", e.target.value)}
                    />
                </div>

                <div style={rowStyle}>
                    <label style={labelStyle}>Supplier Code:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["Supplier Code"] || ""}
                        onChange={(e) => handleFieldChange("Supplier Code", e.target.value)}
                    />
                </div>
            </section>

            {/* Engineering Info */}
            <section style={sectionStyle}>
                <h3 style={headerStyle}>Engineering Info</h3>

                <div style={rowStyle}>
                    <label style={labelStyle}>Size:</label>
                    <input
                        style={inputStyle}
                        type="text"
                        value={localItem["Size"] || ""}
                        onChange={(e) => handleFieldChange("Size", e.target.value)}
                    />
                </div>
            </section>
        </div>
    );
}
