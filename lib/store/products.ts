export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageSrc: string;
  imageAlt: string;
  sku: string;
  initialStock: number;
  accountingCode: string;
};

export const STORE_PRODUCTS: StoreProduct[] = [
  {
    id: "double-side-twisted-loop-drying-microfiber",
    name: "Double Side Twisted Loop Drying Microfiber",
    description: "1400 GSM drying microfiber towel, 60x90cm.",
    price: 95,
    imageSrc: "/assets/store/drying-microfiber.jpg",
    imageAlt: "drying microfiber",
    sku: "BT-DRY-MF-1400",
    initialStock: 25,
    accountingCode: "STORE-CAR-CARE",
  },
  {
    id: "glass-cleaning-microfiber-set",
    name: "Glass Cleaning Microfiber",
    description: "260 GSM glass cleaning microfiber, 40x40cm set of 3 pieces.",
    price: 55,
    imageSrc: "/assets/store/glass-cleaning-microfiber.jpeg",
    imageAlt: "glass cleaning microfiber",
    sku: "BT-GLASS-MF-3PC",
    initialStock: 30,
    accountingCode: "STORE-CAR-CARE",
  },
  {
    id: "suede-microfiber-set",
    name: "Suede Microfiber",
    description: "220 GSM suede microfiber, 40x40cm set of 3 pieces.",
    price: 49,
    imageSrc: "/assets/store/suede-microfiber.jpeg",
    imageAlt: "suede microfiber",
    sku: "BT-SUEDE-MF-3PC",
    initialStock: 30,
    accountingCode: "STORE-CAR-CARE",
  },
  {
    id: "detailing-brush-set",
    name: "Detailing Brush Set",
    description: "Five-piece detailing brush set for tight trim and interior areas.",
    price: 59,
    imageSrc: "/assets/store/detailing-brush-set.jpeg",
    imageAlt: "detailing brush",
    sku: "BT-DETAIL-BRUSH-5PC",
    initialStock: 18,
    accountingCode: "STORE-TOOLS",
  },
  {
    id: "product-5",
    name: "Product 5",
    description: "Bubbleit store product listed on the official shop.",
    price: 139,
    imageSrc: "/assets/store/product-5.jpg",
    imageAlt: "Bubbleit product",
    sku: "BT-PRODUCT-5",
    initialStock: 12,
    accountingCode: "STORE-CAR-CARE",
  },
  {
    id: "bubbleit-tissue-box",
    name: "Bubbleit Tissue Box",
    description:
      "Value pack of 6 premium tissue boxes for cars, homes, and offices.",
    price: 35,
    imageSrc: "/assets/store/bubbleit-tissue-box.jpg",
    imageAlt: "Bubbleit tissue box",
    sku: "BT-TISSUE-6PC",
    initialStock: 40,
    accountingCode: "STORE-ACCESSORIES",
  },
  {
    id: "microfiber-washing-sponge",
    name: "Microfiber Washing Sponge",
    description: "Microfiber washing sponge, 10x26cm.",
    price: 39,
    imageSrc: "/assets/store/microfiber-washing-sponge.jpeg",
    imageAlt: "washing sponge",
    sku: "BT-WASH-SPONGE",
    initialStock: 35,
    accountingCode: "STORE-CAR-CARE",
  },
  {
    id: "microfiber-brush",
    name: "Microfiber Brush",
    description: "Microfiber brush, 29x5cm.",
    price: 29,
    imageSrc: "/assets/store/microfiber-brush.jpeg",
    imageAlt: "microfiber brush",
    sku: "BT-MF-BRUSH",
    initialStock: 35,
    accountingCode: "STORE-TOOLS",
  },
  {
    id: "microfiber-washing-gloves",
    name: "Microfiber Washing Gloves",
    description: "Microfiber washing gloves, 20x27cm.",
    price: 48,
    imageSrc: "/assets/store/microfiber-washing-gloves.jpeg",
    imageAlt: "washing gloves",
    sku: "BT-WASH-GLOVES",
    initialStock: 28,
    accountingCode: "STORE-CAR-CARE",
  },
  {
    id: "drill-brush-adapter-set",
    name: "Drill Brush With Adapter Set",
    description: "Five-piece drill brush set with adapter.",
    price: 75,
    imageSrc: "/assets/store/drill-brush-adapter-set.jpeg",
    imageAlt: "drill brush",
    sku: "BT-DRILL-BRUSH-5PC",
    initialStock: 16,
    accountingCode: "STORE-TOOLS",
  },
];

export function formatStorePrice(price: number) {
  return `QAR ${price.toFixed(2)}`;
}
