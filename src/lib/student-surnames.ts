import type { Snapshot } from "./types";

const DEMO_SURNAMES: Record<string, readonly [string, string]> = {
  "s-sofia:Madrid": ["Madrid", "Herrera"],
  "s-lucas:Madrid": ["Madrid", "Herrera"],
  "s-mateo:López": ["López", "Castillo"],
  "s-regina:Soto": ["Soto", "Mendoza"],
  "s-diego:Ruiz": ["Ruiz", "Aguilar"],
  "s-emilia:Reyes": ["Reyes", "Serrano"],
  "s-santiago:Reyes": ["Reyes", "Serrano"],
  "s-valentina:García": ["García", "Valdez"],
  "s-joaquin:Fernández": ["Fernández", "Ramos"],
  "s-camila:Navarro": ["Navarro", "Cervantes"],
  "s-iker:Navarro": ["Navarro", "Cervantes"],
  "s-renata:Castro": ["Castro", "Salazar"],
  "s-leon:Morales": ["Morales", "Fuentes"],
  "s-amanda:Herrera": ["Herrera", "Carrillo"],
  "s-bruno:Peña": ["Peña", "Delgado"],
  "s-olivia:Mendoza": ["Mendoza", "Montes"],
  "s-emiliano:Márquez": ["Márquez", "Espinoza"],
  "s-isabela:Márquez": ["Márquez", "Espinoza"],
  "s-paula:Márquez": ["Márquez", "Espinoza"],
  "s-renata:Vázquez": ["Vázquez", "Vega"],
  "s-thiago:Vázquez": ["Vázquez", "Vega"],
  "s-noah:Ramírez": ["Ramírez", "Medina"],
  "s-mia:Ramírez": ["Ramírez", "Medina"],
  "s-diego-torres:Torres": ["Torres", "Acosta"],
  "s-luna:Torres": ["Torres", "Acosta"],
};

export function hydrateStudentSurnames(snapshot: Snapshot) {
  for (const student of snapshot.students) {
    const names = DEMO_SURNAMES[`${student.id}:${student.lastName}`];
    if (names && student.lastName === names[0]) student.lastName = names.join(" ");
    if (student.id.startsWith("s-sim") && !student.lastName.trim().includes(" ")) {
      const family = snapshot.guardians.find((guardian) => guardian.studentIds.includes(student.id));
      const key = family?.id ?? student.lastName;
      const index = [...key].reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
      const names = ["Herrera", "Mendoza", "Castillo", "Salazar", "Cervantes", "Espinoza", "Aguilar"];
      student.lastName = `${student.lastName} ${names[index % names.length]}`.trim();
    }
  }
  return snapshot;
}
