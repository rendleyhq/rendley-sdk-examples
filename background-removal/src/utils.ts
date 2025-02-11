export function hexToVec3(hex: string) {
  hex = hex.replace(/^#/, "");

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Normalize to [0,1] range
  return [r / 255, g / 255, b / 255];
}

export function vec3ToHex(vec3: [number, number, number]) {
  const r = Math.round(vec3[0] * 255);
  const g = Math.round(vec3[1] * 255);
  const b = Math.round(vec3[2] * 255);

  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
