export function isAdultOn(date: string, reference = new Date()) {
  const birthDate = new Date(`${date}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return false;
  const minimumBirthDate = new Date(reference);
  minimumBirthDate.setFullYear(minimumBirthDate.getFullYear() - 18);
  return birthDate <= minimumBirthDate;
}
