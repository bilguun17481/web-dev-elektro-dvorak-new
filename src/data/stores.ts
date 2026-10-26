/** The six branches. `canShipDirectly` feeds the allocation rule, not the shop pages. */
export interface Store {
  readonly erpCode: string;
  readonly slug: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly canShipDirectly: boolean;
  readonly sortId: number;
}

export const stores: readonly Store[] = [
  {
    erpCode: "GJ",
    slug: "golcuv-jenikov",
    name: "Golčův Jeníkov",
    address: "Golčův Jeníkov",
    phone: "",
    canShipDirectly: true,
    sortId: 1,
  },
  {
    erpCode: "CA",
    slug: "caslav",
    name: "Čáslav",
    address: "Čáslav",
    phone: "",
    canShipDirectly: true,
    sortId: 2,
  },
  {
    erpCode: "CH",
    slug: "chotebor",
    name: "Chotěboř",
    address: "Chotěboř",
    phone: "",
    canShipDirectly: true,
    sortId: 3,
  },
  {
    erpCode: "SV",
    slug: "svetla-nad-sazavou",
    name: "Světlá nad Sázavou",
    address: "Světlá nad Sázavou",
    phone: "",
    canShipDirectly: true,
    sortId: 4,
  },
  {
    erpCode: "TR",
    slug: "tremosnice",
    name: "Třemošnice",
    address: "Třemošnice",
    phone: "",
    canShipDirectly: true,
    sortId: 5,
  },
  {
    erpCode: "HM",
    slug: "hermanuv-mestec",
    name: "Heřmanův Městec",
    address: "Heřmanův Městec",
    phone: "",
    canShipDirectly: true,
    sortId: 6,
  },
];
