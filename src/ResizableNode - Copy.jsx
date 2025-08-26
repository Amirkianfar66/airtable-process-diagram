import React, { useState } from "react";

export default function UnitLayoutConfig({ onChange }) {
  const [text, setText] = useState("UnitA, UnitB, UnitC");

  const handleChange = (e) => {
    setText(e.target.value);
    const arr = e.target.value.split(",").map(s => s.trim());
    onChange(arr); // send back to parent
  };

  return (
    <div>
      <label>Unit Layout Order:</label>
      <input
        type="text"
        value={text}
        onChange={handleChange}
        placeholder="Enter units separated by commas"
        style={{ width: "400px" }}
      />
    </div>
  );
}
