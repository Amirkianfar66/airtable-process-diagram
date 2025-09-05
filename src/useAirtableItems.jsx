// src/hooks/useAirtableItems.js
import { useState, useEffect, useCallback } from "react";

export default function useAirtableItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/items");
      const json = await res.json();
      setItems(json.items || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (fields) => {
    // optimistic UI
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, ...fields };
    setItems(prev => [...prev, optimistic]);

    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const json = await res.json();
      // replace temp with real record
      setItems(prev => prev.map(i => i.id === tempId ? { id: json.id, ...json.fields } : i));
      return json;
    } catch (err) {
      // rollback
      setItems(prev => prev.filter(i => i.id !== tempId));
      throw err;
    }
  };

  const updateItem = async (id, fields) => {
    // optimistic update
    const prev = items;
    setItems(prevItems => prevItems.map(i => i.id === id ? { ...i, ...fields } : i));
    try {
      const res = await fetch("/api/items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, fields }),
      });
      const json = await res.json();
      // reconcile with server response if needed
      setItems(prevItems => prevItems.map(i => i.id === id ? { id: json.id, ...json.fields } : i));
      return json;
    } catch (err) {
      // rollback
      setItems(prev);
      throw err;
    }
  };

  const deleteItem = async (id) => {
    const prev = items;
    setItems(prevItems => prevItems.filter(i => i.id !== id));
    try {
      await fetch(`/api/items?id=${id}`, { method: "DELETE" });
      return true;
    } catch (err) {
      setItems(prev);
      throw err;
    }
  };

  return { items, loading, error, fetchItems, addItem, updateItem, deleteItem };
}
