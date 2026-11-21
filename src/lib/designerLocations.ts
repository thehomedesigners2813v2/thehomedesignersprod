export const DESIGNER_CITIES = ['Pune'] as const;

const PUNE_AREAS = [
  'Aundh',
  'Balewadi',
  'Baner',
  'Bavdhan',
  'Bibwewadi',
  'Camp',
  'Chinchwad',
  'Deccan',
  'Dhanori',
  'Erandwane',
  'Hadapsar',
  'Hinjewadi',
  'Kalyani Nagar',
  'Karve Nagar',
  'Katraj',
  'Kharadi',
  'Kondhwa',
  'Koregaon Park',
  'Kothrud',
  'Lohegaon',
  'Magarpatta',
  'Model Colony',
  'Mundhwa',
  'NIBM',
  'Pashan',
  'Pimple Saudagar',
  'Pimpri',
  'Shivajinagar',
  'Sinhagad Road',
  'Swargate',
  'Undri',
  'Viman Nagar',
  'Wagholi',
  'Wakad',
  'Wanowrie',
  'Warje',
  'Yerwada',
];

export const SUBLOCATIONS_BY_CITY: Record<string, string[]> = {
  Pune: PUNE_AREAS,
};

export const sublocationsFor = (city: string) => SUBLOCATIONS_BY_CITY[city] || [];

export const formatDesignerArea = (location?: string | null, sublocation?: string | null) => {
  if (sublocation && location) return `${sublocation}, ${location}`;
  return sublocation || location || '';
};
