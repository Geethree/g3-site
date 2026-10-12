export interface ImageAsset {
  src: string;
  width: number;
  height: number;
  variants: { url: string; width: number }[];
}

export interface Project {
  slug: string;
  name: string;
  event: string;
  year: number;
  url: string;
  cover?: ImageAsset;
  coverAlt: string;
}
