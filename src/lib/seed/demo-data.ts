import { LEVEL_LABELS, SCHOOL } from "../school";
import type { PickupEvent, Snapshot } from "../types";

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export const HERO_GUARDIAN_ID = "g-roberto";
export const BENJAMIN_GUARDIAN_ID = "g-benjamin";
export const STAFF_ID = "st-gabriela";

export function createSeedSnapshot(): Snapshot {
  const snapshot: Snapshot = {
    school: {
      name: SCHOOL.name,
      city: SCHOOL.city,
      address: SCHOOL.address,
    },
    zones: [
      {
        id: "zone-preschool",
        nameEs: "Puerta Preescolar",
        nameEn: "Preschool Gate",
        shortEs: "Preescolar",
        shortEn: "Preschool",
      },
      {
        id: "zone-elementary",
        nameEs: "Puerta Primaria",
        nameEn: "Elementary Gate",
        shortEs: "Primaria",
        shortEn: "Elementary",
      },
    ],
    students: [
      {
        id: "s-sofia",
        firstName: "Sofía",
        lastName: "Madrid",
        level: "grade-3",
        group: "Grupo B",
        zoneId: "zone-elementary",
        dismissalTime: "2:45 p.m.",
        accent: "#1B4D3E",
        gender: "f",
      },
      {
        id: "s-lucas",
        firstName: "Lucas",
        lastName: "Madrid",
        level: "grade-1",
        group: "Grupo A",
        zoneId: "zone-elementary",
        dismissalTime: "2:30 p.m.",
        accent: "#3E6B54",
        gender: "m",
      },
      {
        id: "s-mateo",
        firstName: "Mateo",
        lastName: "López",
        level: "grade-2",
        group: "Grupo A",
        zoneId: "zone-elementary",
        dismissalTime: "2:30 p.m.",
        accent: "#2F5D4A",
        gender: "m",
      },
      {
        id: "s-regina",
        firstName: "Regina",
        lastName: "Soto",
        level: "grade-4",
        group: "Grupo A",
        zoneId: "zone-elementary",
        dismissalTime: "2:45 p.m.",
        accent: "#C4A15A",
        gender: "f",
      },
      {
        id: "s-diego",
        firstName: "Diego",
        lastName: "Ruiz",
        level: "kindergarten",
        group: "K",
        zoneId: "zone-preschool",
        dismissalTime: "1:15 p.m.",
        accent: "#8A6B32",
        gender: "m",
      },
      {
        id: "s-emilia",
        firstName: "Emilia",
        lastName: "Reyes",
        level: "pre-kinder",
        group: "PK",
        zoneId: "zone-preschool",
        dismissalTime: "1:00 p.m.",
        accent: "#6B4F2A",
        gender: "f",
      },
      {
        id: "s-santiago",
        firstName: "Santiago",
        lastName: "Reyes",
        level: "grade-5",
        group: "Grupo B",
        zoneId: "zone-elementary",
        dismissalTime: "2:45 p.m.",
        accent: "#1B4D3E",
        gender: "m",
      },
      {
        id: "s-valentina",
        firstName: "Valentina",
        lastName: "García",
        level: "toddlers-a",
        group: "TA",
        zoneId: "zone-preschool",
        dismissalTime: "12:30 p.m.",
        accent: "#A4843D",
        gender: "f",
      },
      {
        id: "s-joaquin",
        firstName: "Joaquín",
        lastName: "Fernández",
        level: "grade-6",
        group: "Grupo A",
        zoneId: "zone-elementary",
        dismissalTime: "2:45 p.m.",
        accent: "#12382D",
        gender: "m",
      },
      {
        id: "s-camila",
        firstName: "Camila",
        lastName: "Navarro",
        level: "primary",
        group: "P",
        zoneId: "zone-preschool",
        dismissalTime: "12:45 p.m.",
        accent: "#4A6B3A",
        gender: "f",
      },
      {
        id: "s-iker",
        firstName: "Iker",
        lastName: "Navarro",
        level: "grade-2",
        group: "Grupo B",
        zoneId: "zone-elementary",
        dismissalTime: "2:30 p.m.",
        accent: "#2A5344",
        gender: "m",
      },
      {
        id: "s-renata",
        firstName: "Renata",
        lastName: "Castro",
        level: "grade-3",
        group: "Grupo A",
        zoneId: "zone-elementary",
        dismissalTime: "2:45 p.m.",
        accent: "#7A5A2E",
        gender: "f",
      },
      {
        id: "s-leon",
        firstName: "León",
        lastName: "Morales",
        level: "kindergarten",
        group: "K",
        zoneId: "zone-preschool",
        dismissalTime: "1:15 p.m.",
        accent: "#1B4D3E",
        gender: "m",
      },
      {
        id: "s-amanda",
        firstName: "Amanda",
        lastName: "Herrera",
        level: "grade-1",
        group: "Grupo B",
        zoneId: "zone-elementary",
        dismissalTime: "2:30 p.m.",
        accent: "#3A5C4C",
        gender: "f",
      },
      {
        id: "s-bruno",
        firstName: "Bruno",
        lastName: "Peña",
        level: "grade-4",
        group: "Grupo B",
        zoneId: "zone-elementary",
        dismissalTime: "2:45 p.m.",
        accent: "#5C4A28",
        gender: "m",
      },
      {
        id: "s-olivia",
        firstName: "Olivia",
        lastName: "Mendoza",
        level: "pre-kinder",
        group: "PK",
        zoneId: "zone-preschool",
        dismissalTime: "1:00 p.m.",
        accent: "#8C6A3C",
        gender: "f",
      },
      {
        id: "s-emiliano",
        firstName: "Emiliano",
        lastName: "Márquez",
        level: "grade-4",
        group: "Grupo A",
        zoneId: "zone-elementary",
        dismissalTime: "2:45 p.m.",
        accent: "#1B4D3E",
        gender: "m",
      },
      {
        id: "s-isabela",
        firstName: "Isabela",
        lastName: "Márquez",
        level: "grade-1",
        group: "Grupo B",
        zoneId: "zone-elementary",
        dismissalTime: "2:30 p.m.",
        accent: "#3E6B54",
        gender: "f",
      },
      {
        id: "s-paula",
        firstName: "Paula",
        lastName: "Márquez",
        level: "pre-kinder",
        group: "PK",
        zoneId: "zone-preschool",
        dismissalTime: "1:00 p.m.",
        accent: "#C4A15A",
        gender: "f",
      },
    ],
    guardians: [
      {
        id: HERO_GUARDIAN_ID,
        firstName: "Roberto",
        lastName: "Madrid",
        relationEs: "Papá",
        relationEn: "Dad",
        studentIds: ["s-sofia", "s-lucas"],
        defaultVehicleId: "v-prius",
        phone: "686 555 0142",
      },
      {
        id: "g-laura",
        firstName: "Laura",
        lastName: "López",
        relationEs: "Mamá",
        relationEn: "Mom",
        studentIds: ["s-mateo"],
        defaultVehicleId: "v-crv",
        phone: "686 555 0188",
      },
      {
        id: "g-pedro",
        firstName: "Pedro",
        lastName: "Soto",
        relationEs: "Papá",
        relationEn: "Dad",
        studentIds: ["s-regina"],
        defaultVehicleId: "v-tiguan",
        phone: "686 555 0110",
      },
      {
        id: "g-ana",
        firstName: "Ana",
        lastName: "Ruiz",
        relationEs: "Mamá",
        relationEn: "Mom",
        studentIds: ["s-diego"],
        phone: "686 555 0194",
      },
      {
        id: "g-carmen",
        firstName: "Carmen",
        lastName: "Reyes",
        relationEs: "Mamá",
        relationEn: "Mom",
        studentIds: ["s-emilia", "s-santiago"],
        defaultVehicleId: "v-trax",
        phone: "686 555 0160",
      },
      {
        id: "g-miguel",
        firstName: "Miguel",
        lastName: "García",
        relationEs: "Papá",
        relationEn: "Dad",
        studentIds: ["s-valentina"],
        phone: "686 555 0127",
      },
      {
        id: "g-elena",
        firstName: "Elena",
        lastName: "Navarro",
        relationEs: "Mamá",
        relationEn: "Mom",
        studentIds: ["s-camila", "s-iker"],
        defaultVehicleId: "v-corolla",
        phone: "686 555 0133",
      },
      {
        id: "g-benjamin",
        firstName: "Benjamín",
        lastName: "Márquez",
        relationEs: "Papá",
        relationEn: "Dad",
        studentIds: ["s-emiliano", "s-isabela", "s-paula"],
        defaultVehicleId: "v-kicks",
        phone: "686 555 0206",
      },
    ],
    authorizedPeople: [
      {
        id: "a-rosa",
        firstName: "Rosa",
        lastName: "Madrid",
        relationEs: "Abuela",
        relationEn: "Grandmother",
        studentIds: ["s-sofia", "s-lucas"],
      },
      {
        id: "a-andres",
        firstName: "Andrés",
        lastName: "López",
        relationEs: "Tío",
        relationEn: "Uncle",
        studentIds: ["s-mateo"],
      },
      {
        id: "a-claudia",
        firstName: "Claudia",
        lastName: "Márquez",
        relationEs: "Tía",
        relationEn: "Aunt",
        studentIds: ["s-emiliano", "s-isabela", "s-paula"],
      },
    ],
    vehicles: [
      {
        id: "v-prius",
        label: "Toyota Prius gris",
        color: "Gris",
        plate: "MKZ-4821",
        ownerGuardianId: HERO_GUARDIAN_ID,
        photoUrl: "/cars/v-prius.jpg",
      },
      {
        id: "v-crv",
        label: "Honda CR-V blanca",
        color: "Blanca",
        plate: "BCS-1190",
        ownerGuardianId: "g-laura",
        photoUrl: "/cars/v-crv.jpg",
      },
      {
        id: "v-tiguan",
        label: "Volkswagen Tiguan azul",
        color: "Azul",
        plate: "MXL-7742",
        ownerGuardianId: "g-pedro",
        photoUrl: "/cars/v-tiguan.jpg",
      },
      {
        id: "v-trax",
        label: "Chevrolet Trax negra",
        color: "Negra",
        plate: "SOL-3058",
        ownerGuardianId: "g-carmen",
        photoUrl: "/cars/v-trax.jpg",
      },
      {
        id: "v-corolla",
        label: "Toyota Corolla plata",
        color: "Plata",
        plate: "RIV-2264",
        ownerGuardianId: "g-elena",
        photoUrl: "/cars/v-corolla.jpg",
      },
      {
        id: "v-kicks",
        label: "Nissan Kicks gris",
        color: "Gris",
        plate: "MXL-2068",
        ownerGuardianId: "g-benjamin",
        photoUrl: "/cars/v-kicks.jpg",
      },
      {
        id: "v-sentra",
        label: "Nissan Sentra rojo",
        color: "Rojo",
        plate: "MXL-5583",
        ownerGuardianId: "g-ana",
        photoUrl: "/cars/v-sentra.jpg",
      },
      {
        id: "v-explorer",
        label: "Ford Explorer gris",
        color: "Gris",
        plate: "SOL-6612",
        ownerGuardianId: "g-miguel",
        photoUrl: "/cars/v-explorer.jpg",
      },
    ],
    staff: [
      {
        id: STAFF_ID,
        firstName: "Gabriela",
        lastName: "Núñez",
        name: "Mtra. Gabriela Núñez",
        titleEs: "Coordinación de salida",
        titleEn: "Dismissal coordinator",
      },
      {
        id: "st-alejandra",
        firstName: "Alejandra",
        lastName: "Ríos",
        name: "Mtra. Alejandra Ríos",
        titleEs: "Preescolar",
        titleEn: "Preschool",
      },
      {
        id: "st-luis",
        firstName: "Luis",
        lastName: "Ortega",
        name: "Mtro. Luis Ortega",
        titleEs: "Primaria",
        titleEn: "Elementary",
      },
    ],
    guestPasses: [],
    events: [],
    trips: [
      {
        id: "t-lopez",
        code: "2291",
        guardianId: "g-laura",
        pickerName: "Laura López",
        pickerRelationEs: "Mamá",
        pickerRelationEn: "Mom",
        pickerKind: "self",
        method: "car",
        vehicleId: "v-crv",
        qrToken: "pass-lopez",
        createdAt: minutesAgo(8),
        arrivedAt: minutesAgo(3),
        arrivalPhoto: fallbackArrivalPhoto("Honda CR-V blanca", "Blanca"),
      },
      {
        id: "t-soto",
        code: "7740",
        guardianId: "g-pedro",
        pickerName: "Pedro Soto",
        pickerRelationEs: "Papá",
        pickerRelationEn: "Dad",
        pickerKind: "self",
        method: "car",
        vehicleId: "v-tiguan",
        qrToken: "pass-soto",
        createdAt: minutesAgo(12),
        arrivedAt: minutesAgo(4),
        arrivalPhoto: fallbackArrivalPhoto("Volkswagen Tiguan azul", "Azul"),
      },
      {
        id: "t-ruiz",
        code: "1503",
        guardianId: "g-ana",
        pickerName: "Ana Ruiz",
        pickerRelationEs: "Mamá",
        pickerRelationEn: "Mom",
        pickerKind: "self",
        method: "car",
        vehicleId: "v-sentra",
        qrToken: "pass-ruiz",
        createdAt: minutesAgo(18),
        arrivedAt: minutesAgo(9),
        arrivalPhoto: fallbackArrivalPhoto("Nissan Sentra rojo", "Rojo"),
      },
      {
        id: "t-navarro",
        code: "3388",
        guardianId: "g-elena",
        pickerName: "Elena Navarro",
        pickerRelationEs: "Mamá",
        pickerRelationEn: "Mom",
        pickerKind: "self",
        method: "car",
        vehicleId: "v-corolla",
        qrToken: "pass-navarro",
        createdAt: minutesAgo(22),
        arrivedAt: minutesAgo(14),
        arrivalPhoto: fallbackArrivalPhoto("Toyota Corolla plata", "Plata"),
      },
      {
        id: "t-garcia",
        code: "9012",
        guardianId: "g-miguel",
        pickerName: "Miguel García",
        pickerRelationEs: "Papá",
        pickerRelationEn: "Dad",
        pickerKind: "self",
        method: "car",
        vehicleId: "v-explorer",
        qrToken: "pass-garcia",
        createdAt: minutesAgo(40),
        arrivedAt: minutesAgo(28),
        arrivalPhoto: fallbackArrivalPhoto("Ford Explorer gris", "Gris"),
      },
    ],
    requests: [
      {
        id: "r-mateo",
        tripId: "t-lopez",
        studentId: "s-mateo",
        status: "arrived",
        requestedAt: minutesAgo(8),
        arrivedAt: minutesAgo(3),
      },
      {
        id: "r-regina",
        tripId: "t-soto",
        studentId: "s-regina",
        status: "arrived",
        requestedAt: minutesAgo(12),
        arrivedAt: minutesAgo(4),
      },
      {
        id: "r-diego",
        tripId: "t-ruiz",
        studentId: "s-diego",
        status: "preparing",
        requestedAt: minutesAgo(18),
        arrivedAt: minutesAgo(9),
        preparingAt: minutesAgo(6),
      },
      {
        id: "r-camila",
        tripId: "t-navarro",
        studentId: "s-camila",
        status: "preparing",
        requestedAt: minutesAgo(22),
        arrivedAt: minutesAgo(14),
        preparingAt: minutesAgo(3),
      },
      {
        id: "r-iker",
        tripId: "t-navarro",
        studentId: "s-iker",
        status: "preparing",
        requestedAt: minutesAgo(22),
        arrivedAt: minutesAgo(14),
        preparingAt: minutesAgo(8),
      },
      {
        id: "r-valentina",
        tripId: "t-garcia",
        studentId: "s-valentina",
        status: "delivered",
        requestedAt: minutesAgo(40),
        arrivedAt: minutesAgo(28),
        preparingAt: minutesAgo(24),
        readyAt: minutesAgo(20),
        deliveredAt: minutesAgo(16),
        deliveredByStaffName: "Mtra. Gabriela Núñez",
      },
    ],
    updatedAt: new Date().toISOString(),
  };
  snapshot.events = buildSeedEvents(snapshot);
  return snapshot;
}

function buildSeedEvents(snapshot: Snapshot): PickupEvent[] {
  const events: PickupEvent[] = [];
  let index = 0;
  const push = (event: Omit<PickupEvent, "id">) => {
    index += 1;
    events.push({ ...event, id: `ev-seed-${index}` });
  };

  const guardianName = (tripId: string) => {
    const trip = snapshot.trips.find((item) => item.id === tripId);
    const guardian = trip && snapshot.guardians.find((item) => item.id === trip.guardianId);
    return guardian ? `${guardian.firstName} ${guardian.lastName}` : undefined;
  };

  const stageStaff = (studentId?: string) => {
    const student = snapshot.students.find((item) => item.id === studentId);
    if (!student) return "Personal de Discovery";
    return LEVEL_LABELS[student.level].stage === "preschool"
      ? "Mtra. Alejandra Ríos"
      : "Mtro. Luis Ortega";
  };

  for (const trip of snapshot.trips) {
    push({
      at: trip.createdAt,
      type: "trip_created",
      tripId: trip.id,
      actorRole: "parent",
      actorName: guardianName(trip.id),
    });
    if (trip.arrivedAt) {
      push({
        at: trip.arrivedAt,
        type: "arrived",
        tripId: trip.id,
        actorRole: "kiosk",
        actorName: trip.pickerName,
      });
    }
  }

  for (const request of snapshot.requests) {
    if (request.preparingAt) {
      push({
        at: request.preparingAt,
        type: "status_changed",
        tripId: request.tripId,
        requestId: request.id,
        studentId: request.studentId,
        actorRole: "staff",
        actorName: stageStaff(request.studentId),
        fromStatus: "arrived",
        toStatus: "preparing",
      });
    }
    if (request.readyAt) {
      push({
        at: request.readyAt,
        type: "status_changed",
        tripId: request.tripId,
        requestId: request.id,
        studentId: request.studentId,
        actorRole: "staff",
        actorName: stageStaff(request.studentId),
        fromStatus: "preparing",
        toStatus: "ready",
      });
    }
    if (request.deliveredAt) {
      push({
        at: request.deliveredAt,
        type: "delivered",
        tripId: request.tripId,
        requestId: request.id,
        studentId: request.studentId,
        actorRole: "staff",
        actorName: request.deliveredByStaffName ?? stageStaff(request.studentId),
        fromStatus: "ready",
        toStatus: "delivered",
      });
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}

const CAR_TINTS: Record<string, string> = {
  Gris: "#8a919a",
  Blanca: "#e6e9ec",
  Blanco: "#e6e9ec",
  Azul: "#3f6f9e",
  Negra: "#23272e",
  Negro: "#23272e",
  Plata: "#b9bec4",
  Rojo: "#b3402f",
  Roja: "#b3402f",
};

const SUV_KEYWORDS = ["cr-v", "tiguan", "trax", "kicks", "explorer", "suv", "rav4", "sportage", "runner"];

export function fallbackArrivalPhoto(label: string, color?: string) {
  const tint = (color && CAR_TINTS[color]) || "#1B4D3E";
  const isSuv = SUV_KEYWORDS.some((key) => label.toLowerCase().includes(key));
  const svg = isSuv ? suvSvg(tint, label) : sedanSvg(tint, label);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function sedanSvg(tint: string, label: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#eef2ee"/>
      <rect x="0" y="300" width="640" height="60" fill="#dfe7e0"/>
      <ellipse cx="320" cy="302" rx="225" ry="13" fill="#0f1712" opacity="0.08"/>

      <circle cx="202" cy="274" r="33" fill="#1c2220"/>
      <circle cx="202" cy="274" r="15" fill="#c4cbc7"/>
      <circle cx="202" cy="274" r="6" fill="#828a86"/>
      <circle cx="436" cy="274" r="33" fill="#1c2220"/>
      <circle cx="436" cy="274" r="15" fill="#c4cbc7"/>
      <circle cx="436" cy="274" r="6" fill="#828a86"/>

      <rect x="118" y="206" width="366" height="60" rx="26" fill="${tint}"/>
      <path d="M200 206 L240 148 Q246 140 258 140 L304 140 Q316 140 322 148 L372 206 Z" fill="${tint}"/>

      <path d="M216 204 L250 156 Q254 152 258 152 L298 152 Q304 152 308 156 L354 204 Z" fill="#cfe0da"/>
      <line x1="282" y1="148" x2="292" y2="204" stroke="${tint}" stroke-width="5"/>

      <rect x="320" y="192" width="22" height="5" rx="2.5" fill="#00000020"/>
      <path d="M122 234 L132 222 L146 222 L140 234 Z" fill="#eef2ee"/>
      <rect x="474" y="222" width="12" height="10" rx="3" fill="#e8bd86"/>
      <text x="320" y="342" text-anchor="middle" fill="#1b4d3e" font-family="Georgia, serif" font-size="22">${label}</text>
    </svg>
  `.trim();
}

function suvSvg(tint: string, label: string) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <rect width="640" height="360" fill="#eef2ee"/>
      <rect x="0" y="300" width="640" height="60" fill="#dfe7e0"/>
      <ellipse cx="320" cy="302" rx="235" ry="14" fill="#0f1712" opacity="0.08"/>

      <circle cx="198" cy="278" r="36" fill="#1c2220"/>
      <circle cx="198" cy="278" r="16" fill="#c4cbc7"/>
      <circle cx="198" cy="278" r="6" fill="#828a86"/>
      <circle cx="440" cy="278" r="36" fill="#1c2220"/>
      <circle cx="440" cy="278" r="16" fill="#c4cbc7"/>
      <circle cx="440" cy="278" r="6" fill="#828a86"/>

      <rect x="116" y="194" width="374" height="66" rx="24" fill="${tint}"/>
      <path d="M184 194 L244 132 Q250 124 264 124 L320 124 Q334 124 340 132 L400 194 Z" fill="${tint}"/>

      <path d="M200 192 L252 140 Q256 136 264 136 L314 136 Q322 136 326 140 L382 192 Z" fill="#cfe0da"/>
      <line x1="294" y1="132" x2="304" y2="192" stroke="${tint}" stroke-width="5"/>

      <line x1="270" y1="116" x2="318" y2="116" stroke="#00000025" stroke-width="4" stroke-linecap="round"/>
      <line x1="352" y1="116" x2="400" y2="116" stroke="#00000025" stroke-width="4" stroke-linecap="round"/>

      <rect x="346" y="178" width="22" height="5" rx="2.5" fill="#00000020"/>
      <path d="M120 220 L130 208 L144 208 L138 220 Z" fill="#eef2ee"/>
      <rect x="478" y="208" width="12" height="10" rx="3" fill="#e8bd86"/>
      <text x="320" y="342" text-anchor="middle" fill="#1b4d3e" font-family="Georgia, serif" font-size="22">${label}</text>
    </svg>
  `.trim();
}
