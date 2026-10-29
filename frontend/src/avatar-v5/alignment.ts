// Approximate art guides, NOT generated anatomy. Shared by both fit families.
const point = (x: number, y: number) => Object.freeze({ x, y });
const rect = (x: number, y: number, width: number, height: number) => Object.freeze({ x, y, width, height });
export const AVATAR_V5_ALIGNMENT = Object.freeze({
  master: rect(0, 0, 1024, 1024), centerline: 512,
  safeRegion: rect(160, 48, 704, 912), head: rect(456, 112, 112, 120), eyeLine: 166,
  chin: point(512, 232), neck: point(512, 250),
  shoulders: Object.freeze([point(406, 270), point(618, 270)]),
  torsoY: Object.freeze([270, 480]), waist: point(512, 480), pelvisY: Object.freeze([480, 575]),
  elbows: Object.freeze([point(382, 405), point(642, 405)]),
  wrists: Object.freeze([point(370, 525), point(654, 525)]),
  knees: Object.freeze([point(462, 735), point(562, 735)]),
  ankles: Object.freeze([point(458, 900), point(566, 900)]), soleBaseline: 952,
});
// Initial proof crops; never embedded irreversibly in consumer UI.
export const AVATAR_V5_RENDER_MODES = Object.freeze({
  FULL_BODY: rect(0, 0, 1024, 1024), PROFILE: rect(300, 48, 424, 424),
  COMPACT: rect(364, 48, 296, 296), TINY: rect(404, 48, 216, 216),
});
export type AvatarV5RenderMode = keyof typeof AVATAR_V5_RENDER_MODES;
