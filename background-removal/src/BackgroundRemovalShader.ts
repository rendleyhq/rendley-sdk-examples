export const BackgroundRemovalShader = `
// Inspired from OBS Chroma Key shader, upgraded spill algorithm
varying vec2 vTextureCoord;

uniform sampler2D uSampler;

uniform vec4 inputSize;

uniform vec3 keyColor; // =  vec3(0.012, 0.729, 0.137);
uniform float similarity; // = 0.15;
uniform float smoothness; // = 0.18;
uniform float spill; // = 0.25;

// From https://github.com/libretro/glsl-shaders/blob/master/nnedi3/shaders/rgb-to-yuv.glsl
vec2 RGBtoUV(vec3 rgb) {
  return vec2(
    rgb.r * -0.169 + rgb.g * -0.331 + rgb.b *  0.5    + 0.5,
    rgb.r *  0.5   + rgb.g * -0.419 + rgb.b * -0.081  + 0.5
  );
}

vec4 ProcessChromaKey(vec2 texCoord) {
  vec4 rgba = texture2D(uSampler, texCoord);
  rgba.rgb *= (rgba.a > 0.) ? (1. / rgba.a) : 0.;
  float chromaDist = distance(RGBtoUV(rgba.rgb), RGBtoUV(keyColor));

  float baseMask = chromaDist - similarity;
    float fullMask = pow(clamp(baseMask / smoothness, 0., 1.), 1.5);
  rgba.a *= fullMask;

  float spillVal = pow(clamp(baseMask / spill, 0., 1.), 5.5);
  float desat = clamp(rgba.r * 0.2126 + rgba.g * 0.7152 + rgba.b * 0.0722, 0., 1.);
  rgba.rgb = mix(rgba.rgb * (1.0 - keyColor * 0.4) * 1.3, rgba.rgb, spillVal);

  return rgba;
}

void main()
{
  gl_FragColor = ProcessChromaKey(vTextureCoord);
  gl_FragColor.rgb *= gl_FragColor.a;
}
`;
