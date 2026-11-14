export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  image: string;
  category?: string;
};

export type CustomEntry = {
  name: string;
  imageUrl?: string;
};

const serviceImage = (id: string) => `/catalog/services/${id}.jpg`;

const materialImage = (id: string) => `/catalog/materials/${id}.jpg`;

export const SERVICE_CATALOG: CatalogItem[] = [
  { id: '3d-visualization', name: '3D Visualization', description: 'Realistic interior renderings before work begins.', image: serviceImage('3d-visualization') },
  { id: 'space-planning', name: 'Space Planning', description: 'Floor plans that organise rooms and circulation.', image: serviceImage('space-planning') },
  { id: 'modular-kitchen', name: 'Modular Kitchen', description: 'Modern kitchens planned around storage and workflow.', image: serviceImage('modular-kitchen') },
  { id: 'bedroom-design', name: 'Bedroom Design', description: 'Bedrooms designed for rest, storage and light.', image: serviceImage('bedroom-design') },
  { id: 'living-room-design', name: 'Living Room Design', description: 'Living rooms arranged for everyday use and guests.', image: serviceImage('living-room-design') },
  { id: 'bathroom-design', name: 'Bathroom Design', description: 'Bathrooms planned for fittings, storage and finishes.', image: serviceImage('bathroom-design') },
  { id: 'false-ceiling', name: 'False Ceiling', description: 'Decorative ceilings with lighting and levels.', image: serviceImage('false-ceiling') },
  { id: 'electrical-planning', name: 'Electrical Planning', description: 'Layouts for lights, switches and appliance points.', image: serviceImage('electrical-planning') },
  { id: 'furniture-design', name: 'Furniture Design', description: 'Custom furniture sized to the room.', image: serviceImage('furniture-design') },
  { id: 'complete-home-interiors', name: 'Complete Home Interiors', description: 'A full home designed as one interior.', image: serviceImage('complete-home-interiors') },
  { id: 'commercial-interiors', name: 'Commercial Interiors', description: 'Offices and commercial rooms planned for work.', image: serviceImage('commercial-interiors') },
  { id: 'renovation-remodeling', name: 'Renovation & Remodeling', description: 'Existing homes updated without starting from scratch.', image: serviceImage('renovation-remodeling') },
  { id: 'wallpaper-wall-design', name: 'Wallpaper & Wall Design', description: 'Feature walls, wallpaper and decorative finishes.', image: serviceImage('wallpaper-wall-design') },
  { id: 'lighting-design', name: 'Lighting Design', description: 'Ambient, task and accent lighting for each room.', image: serviceImage('lighting-design') },
  { id: 'civil-carpentry', name: 'Civil & Carpentry Work', description: 'On-site carpentry, partitions and civil finishing.', image: serviceImage('civil-carpentry') }
];

export const MATERIAL_CATALOG: CatalogItem[] = [
  { id: 'teak-wood', name: 'Teak Wood', description: 'Teak grain.', category: 'Wood & Boards', image: materialImage('teak-wood') },
  { id: 'oak-wood', name: 'Oak Wood', description: 'Oak grain.', category: 'Wood & Boards', image: materialImage('oak-wood') },
  { id: 'walnut', name: 'Walnut', description: 'Walnut grain.', category: 'Wood & Boards', image: materialImage('walnut') },
  { id: 'plywood', name: 'Plywood', description: 'Plywood layers.', category: 'Wood & Boards', image: materialImage('plywood') },
  { id: 'mdf', name: 'MDF', description: 'MDF board.', category: 'Wood & Boards', image: materialImage('mdf') },
  { id: 'hdhmr', name: 'HDHMR', description: 'HDHMR board.', category: 'Wood & Boards', image: materialImage('hdhmr') },
  { id: 'particle-board', name: 'Particle Board', description: 'Particle board.', category: 'Wood & Boards', image: materialImage('particle-board') },
  { id: 'laminates', name: 'Laminates', description: 'Decorative laminate samples.', category: 'Surface Finishes', image: materialImage('laminates') },
  { id: 'veneers', name: 'Veneers', description: 'Natural wood veneer.', category: 'Surface Finishes', image: materialImage('veneers') },
  { id: 'acrylic', name: 'Acrylic', description: 'High-gloss acrylic.', category: 'Surface Finishes', image: materialImage('acrylic') },
  { id: 'pu-finish', name: 'PU Finish', description: 'PU finished panel.', category: 'Surface Finishes', image: materialImage('pu-finish') },
  { id: 'membrane-finish', name: 'Membrane Finish', description: 'Membrane finished panel.', category: 'Surface Finishes', image: materialImage('membrane-finish') },
  { id: 'marble', name: 'Marble', description: 'Marble surface.', category: 'Stone', image: materialImage('marble') },
  { id: 'granite', name: 'Granite', description: 'Granite surface.', category: 'Stone', image: materialImage('granite') },
  { id: 'quartz', name: 'Quartz', description: 'Quartz surface.', category: 'Stone', image: materialImage('quartz') },
  { id: 'hinges', name: 'Hinges', description: 'Cabinet hinges.', category: 'Hardware', image: materialImage('hinges') },
  { id: 'channels', name: 'Channels', description: 'Drawer channels.', category: 'Hardware', image: materialImage('channels') },
  { id: 'handles', name: 'Handles', description: 'Cabinet handles.', category: 'Hardware', image: materialImage('handles') },
  { id: 'drawer-systems', name: 'Drawer Systems', description: 'Drawer hardware.', category: 'Hardware', image: materialImage('drawer-systems') },
  { id: 'glass', name: 'Glass', description: 'Glass material.', category: 'Other Materials', image: materialImage('glass') },
  { id: 'aluminium', name: 'Aluminium', description: 'Aluminium finish.', category: 'Other Materials', image: materialImage('aluminium') },
  { id: 'wallpaper', name: 'Wallpaper', description: 'Decorative wallpaper.', category: 'Other Materials', image: materialImage('wallpaper') },
  { id: 'wpc', name: 'WPC', description: 'WPC material.', category: 'Other Materials', image: materialImage('wpc') }
];

export const MATERIAL_CATEGORIES = ['Wood & Boards', 'Surface Finishes', 'Stone', 'Hardware', 'Other Materials'];

export function decodeSelection(stored: string[] | null | undefined, catalog: CatalogItem[]) {
  const ids: string[] = [];
  const custom: CustomEntry[] = [];
  for (const raw of stored || []) {
    if (!raw) continue;
    if (raw.startsWith('id:')) {
      const id = raw.slice(3);
      if (catalog.some((item) => item.id === id)) ids.push(id);
      else custom.push({ name: id });
      continue;
    }
    if (raw.startsWith('custom:')) {
      const body = raw.slice(7);
      const split = body.indexOf('|');
      if (split === -1) custom.push({ name: body });
      else custom.push({ name: body.slice(0, split), imageUrl: body.slice(split + 1) || undefined });
      continue;
    }
    const known = catalog.find((item) => item.id === raw || item.name.toLowerCase() === raw.toLowerCase());
    if (known) ids.push(known.id);
    else custom.push({ name: raw });
  }
  return { ids: Array.from(new Set(ids)), custom };
}

export function encodeSelection(ids: string[], custom: CustomEntry[]) {
  return [
    ...ids.map((id) => `id:${id}`),
    ...custom
      .map((entry) => ({ ...entry, name: entry.name.trim() }))
      .filter((entry) => entry.name)
      .map((entry) => entry.imageUrl ? `custom:${entry.name}|${entry.imageUrl}` : `custom:${entry.name}`)
  ];
}

export function resolveSelection(stored: string[] | null | undefined, catalog: CatalogItem[]) {
  const decoded = decodeSelection(stored, catalog);
  const selected = decoded.ids
    .map((id) => catalog.find((item) => item.id === id))
    .filter((item): item is CatalogItem => Boolean(item));
  const custom = decoded.custom.map((entry) => ({
    id: `custom:${entry.name}`,
    name: entry.name,
    description: 'Added by the designer',
    image: entry.imageUrl || '',
    category: 'Custom'
  }));
  return { selected, custom };
}
