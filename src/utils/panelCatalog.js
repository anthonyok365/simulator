// Panel catalog - structured for easy extension with new manufacturers/products
// Data sourced from manufacturer datasheets

export const PANEL_CATALOG = {
  jinko: {
    label: "JinkoSolar",
    products: {
      400: {
        model: "JKM400N-6RL3-B",
        voc: 45.71,
        isc: 11.08,
        vmp: 38.10,
        imp: 10.50,
        pmax: 400,
        maxSystemVoltage: 1000,
        maxSeriesFuse: 20,
        tempCoeffVoc: -0.28,
        dimensions: [1855, 1029, 30]
      },
      550: {
        model: "JKM550M-72HL4-V",
        voc: 49.62,
        isc: 14.03,
        vmp: 40.90,
        imp: 13.45,
        pmax: 550,
        maxSystemVoltage: 1500,
        maxSeriesFuse: 25,
        tempCoeffVoc: -0.28,
        dimensions: [2274, 1134, 35]
      },
      650: {
        model: "JKM650N-66QL6-BDV",
        voc: 50.26,
        isc: 15.98,
        vmp: 42.57,
        imp: 15.27,
        pmax: 650,
        maxSystemVoltage: 1500,
        maxSeriesFuse: 25, // TODO: confirm against primary datasheet
        tempCoeffVoc: -0.28,
        dimensions: [2382, 1134, 30]
      }
    }
  }
};

// Controller specifications
export const CONTROLLER_SPEC = {
  smartsolar_100_30: {
    model: "Victron SmartSolar MPPT 100/30",
    maxPvVoc: 100,
    maxPvIsc: 35, // Maximum PV input current (A)
    maxChargeCurrent: 30
  }
};

// Get all manufacturers
export function getManufacturers() {
  return Object.keys(PANEL_CATALOG);
}

// Get products for a manufacturer
export function getProducts(manufacturer) {
  const mfr = PANEL_CATALOG[manufacturer];
  if (!mfr) return {};
  return mfr.products;
}

// Get product specs
export function getProductSpecs(manufacturer, wattage) {
  const products = getProducts(manufacturer);
  return products[wattage] || null;
}

// Compute array values
export function computeArray(specs, seriesCount, parallelCount) {
  return {
    stringVoc: +(specs.voc * seriesCount).toFixed(2),
    stringVmp: +(specs.vmp * seriesCount).toFixed(2),
    arrayIsc: +(specs.isc * parallelCount).toFixed(2),
    arrayImp: +(specs.imp * parallelCount).toFixed(2)
  };
}

// Default selection state
export const DEFAULT_SELECTION = {
  manufacturer: 'jinko',
  wattage: 400,
  seriesCount: 1,
  parallelCount: 1
};
