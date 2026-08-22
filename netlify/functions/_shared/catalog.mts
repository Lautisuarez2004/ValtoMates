export type CatalogProduct = {
  id: string;
  title: string;
  price: number;
  variants?: string[];
};

export const catalog: Record<string, CatalogProduct> = {
  "mate-ranchero": { id: "mate-ranchero", title: "Mate ranchero", price: 64000 },
  "ideal-mate-system-12": { id: "ideal-mate-system-12", title: "Ideal Mate System 1.2L", price: 198900, variants: ["Frost", "Coffee", "Dried Pine"] },
  "system-12": { id: "system-12", title: "System 1.2L", price: 188900, variants: ["Crema", "Tostado", "Negro", "Rosa", "Fucsia", "Verde", "Azure"] },
  "quencher-118": { id: "quencher-118", title: "Quencher Protour 1.18L", price: 176644, variants: ["Blanca", "Pistacho", "Hydrangea"] },
  "classic-14": { id: "classic-14", title: "Classic 1.4L", price: 170198, variants: ["Negro", "Rose Quartz", "Lava", "Lilac", "Verde"] },
  "quencher-887": { id: "quencher-887", title: "Quencher Protour 887ml", price: 154773, variants: ["Rose Quartz", "Blanco", "Negro"] },
  "torpedo-animal": { id: "torpedo-animal", title: "Torpedo animal print con virola de alpaca", price: 62200 },
  "imperial-animal": { id: "imperial-animal", title: "Imperial animal print", price: 59200 },
  "canasta-cuero": { id: "canasta-cuero", title: "Canasta cuadrada de cuero", price: 51185, variants: ["Chocolate"] }
};
