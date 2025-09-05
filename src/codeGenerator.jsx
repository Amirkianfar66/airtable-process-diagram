// codeGenerator.js
export function generateCode({ Category, Type, Unit = 0, SubUnit = 0, Sequence = null, SensorType = "" }) {
    // Calculation2
    const calc2 = {
        "Equipment": "0",
        "Inline Valve": "30",
        "Pipe": "00",
        "Duct": "70",
        "Instrument": "4",
        "Structure": "50",
        "Electrical": "80",
        "General": "9",
        "Plant/System": "00"
    }[Category] || "";

    // Calculation3
    const calc3 = {
        "PRESSURE TRANSMITTER": 41,
        "TEMPERATURE TRANSMITTER": 42,
        "PH PROBE SENSOR": 43,
        "O2 DETECTION SENSOR": 44,
        "TURBIDITY ANALYZER PROBE": 45,
        "ETG GAS ANALYZER": 46,
        "LEVEL TRANSMITTER": 47,
        "WEIGHTING SENSOR": 48,
        "Vibration Sensor": 49,
        "Suspended Solids Sensor": 50,
        "Rotation sensor": 51,
        "Salinity Sensor": 52,
        "Pressure Gauge": 54,
        "Flow Transmitter": 6,
        "Positon switch sensor": 53
    }[SensorType] || 40;

    let finalCode = "";

    if (Category === "Equipment" && Sequence !== null) {
        if (Sequence > 9 && calc2 === "0") {
            finalCode = `${Unit}${SubUnit}${Sequence}`;
        } else {
            const codeToUse = calc2 === "4" ? calc3 : calc2;
            finalCode = `${Unit}${SubUnit}${codeToUse}${Sequence || 0}`;
        }
    } else {
        // Non-Equipment items use Calculation2 only
        finalCode = calc2;
    }

    // Take first 5 characters if needed
    return finalCode.toString().slice(0, 5);
}
