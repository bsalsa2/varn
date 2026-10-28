// Final colour grade over the whole frame: midtone lift, gentle saturation and a soft highlight
// shoulder. Imagery is rendered faithfully, then brightened here so the planet reads vivid and
// clear rather than hazy and dark, without clipping snow, cloud or sun glint.
import { PostProcessStage } from 'cesium';

const FS = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
uniform float u_gamma;
uniform float u_gain;
uniform float u_sat;
void main() {
  vec4 c = texture(colorTexture, v_textureCoordinates);
  vec3 rgb = c.rgb;
  float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  rgb = mix(vec3(l), rgb, u_sat);
  rgb = pow(max(rgb, vec3(0.0)), vec3(u_gamma)) * u_gain;
  vec3 over = max(rgb - 0.8, vec3(0.0));
  rgb = min(rgb, vec3(0.8)) + 0.2 * (1.0 - exp(-over / 0.2));
  out_FragColor = vec4(rgb, c.a);
}`;

export const GRADE = { gamma: 0.86, gain: 1.05, saturation: 1.14 };

export function createGrade(scene, grade = GRADE) {
  const stage = new PostProcessStage({
    name: 'varn-grade', fragmentShader: FS,
    uniforms: { u_gamma: grade.gamma, u_gain: grade.gain, u_sat: grade.saturation },
  });
  scene.postProcessStages.add(stage);
  return stage;
}
