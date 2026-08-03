/**
 * Editorial photography for the marketing page.
 *
 * Sourced from Unsplash and vendored into `public/assets/editorial/` rather
 * than hotlinked. Two reasons, in order: a page that fetches from a third-party
 * host tells that host who is reading it and when, which is the exact property
 * this product exists to remove; and a demo that depends on someone else's CDN
 * being reachable is a demo that fails in the room.
 */
export interface Photo {
  src: string;
  /** Empty when the image is decorative and the surrounding copy carries it. */
  alt: string;
  /** Intrinsic size of the vendored file, for `next/image`. */
  width: number;
  height: number;
}

/** Warehouse aisle, deep shadow with a run of overhead light. */
export const HERO_PHOTO: Photo = {
  src: "/assets/editorial/warehouse-aisle.jpg",
  alt: "",
  width: 2400,
  height: 3200,
};

/** Welder at work, sparks against dark blue. */
export const MANUFACTURING_PHOTO: Photo = {
  src: "/assets/editorial/welding.jpg",
  alt: "A welder joining steel pipe, sparks scattering in the dark",
  width: 2400,
  height: 1600,
};

/** Aerial view of articulated lorries at a distribution depot. */
export const LOGISTICS_PHOTO: Photo = {
  src: "/assets/editorial/depot.jpg",
  alt: "Articulated lorries lined up at a distribution depot, seen from above",
  width: 2400,
  height: 1600,
};

/** Racked inventory in a lit distribution centre. */
export const INVENTORY_PHOTO: Photo = {
  src: "/assets/editorial/racking.jpg",
  alt: "Pallet racking filled with cartons in a distribution centre",
  width: 2400,
  height: 1600,
};
